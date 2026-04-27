from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, WebSocket, Depends, Query, Path, Body, Request, status as http_status, HTTPException, BackgroundTasks
from starlette.websockets import WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any, Set, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import httpx
import xml.etree.ElementTree as ET
import json
from decimal import Decimal, ROUND_HALF_UP
from collections import Counter

# Import Shepherd client
from shepherd_client import (
    ShepherdAPIClient, 
    transform_shepherd_menu_to_rnoo, 
    build_shepherd_order,
    get_shepherd_client,
    init_shepherd_client,
    match_menu_to_schedule,
    get_rpower_core_client,
    reset_shepherd_http_history,
    get_shepherd_http_history,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (use safe defaults if env missing)
mongo_url = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017')
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get('DB_NAME', 'rnoo')
db = client[db_name]

# Shepherd Configuration
SHEPHERD_BEARER_TOKEN = os.environ.get('SHEPHERD_BEARER_TOKEN', '')
WEBHOOK_BASE_URL = os.environ.get('WEBHOOK_BASE_URL', '').rstrip('/')
if SHEPHERD_BEARER_TOKEN:
    init_shepherd_client(SHEPHERD_BEARER_TOKEN)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rnoo-super-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# ============== SHEPHERD WEBHOOK HELPERS ==============

# Shepherd push events RNOO subscribes to on startup
SHEPHERD_WEBHOOK_EVENTS = ["ORDERSTATUSUPDATE", "MENUUPDATE", "NEWORDER"]


async def subscribe_shepherd_webhooks_on_startup():
    """Subscribe all active Shepherd-linked merchants to webhook events on startup."""
    shepherd = get_shepherd_client()
    if not shepherd or not WEBHOOK_BASE_URL:
        return

    try:
        merchants = await db.merchants.find(
            {"is_active": True, "shepherd_config.merchant_id": {"$exists": True, "$ne": None}},
            {"_id": 0, "id": 1, "shepherd_config": 1}
        ).to_list(500)

        for merchant in merchants:
            shepherd_merchant_id = merchant.get("shepherd_config", {}).get("merchant_id")
            if not shepherd_merchant_id:
                continue
            callback_url = f"{WEBHOOK_BASE_URL}/api/webhooks/shepherd/{shepherd_merchant_id}"
            for event_id in SHEPHERD_WEBHOOK_EVENTS:
                try:
                    await shepherd.subscribe_webhook_event(shepherd_merchant_id, event_id, callback_url)
                    logger.info(f"Webhook startup: subscribed {shepherd_merchant_id} to {event_id} -> {callback_url}")
                except Exception as e:
                    logger.warning(f"Webhook startup: could not subscribe {shepherd_merchant_id} to {event_id}: {e}")
    except Exception as e:
        logger.error(f"Webhook startup subscription failed: {e}")


async def _handle_shepherd_order_status_update(shepherd_merchant_id: str, payload: dict):
    """Handle ORDERSTATUSUPDATE webhook push from Shepherd."""
    try:
        resolved_merchant_id = await resolve_local_merchant_id(shepherd_merchant_id)

        order_ref = (
            payload.get("id") or payload.get("orderId") or payload.get("order_id") or
            payload.get("OrderId") or payload.get("ref") or payload.get("Ref") or
            payload.get("reference") or payload.get("Reference")
        )
        status_raw = (
            payload.get("status") or payload.get("Status") or
            payload.get("orderStatus") or payload.get("OrderStatus") or ""
        )

        if not order_ref:
            await db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "merchant_id": resolved_merchant_id,
                "action": "shepherd_orderstatusupdate_ignored_no_ref",
                "endpoint": f"/api/webhooks/shepherd/{shepherd_merchant_id}",
                "request_data": {
                    "shepherd_merchant_id": shepherd_merchant_id,
                    "status_raw": status_raw,
                    "payload": payload,
                },
                "status_code": 400,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.warning(f"ORDERSTATUSUPDATE for {shepherd_merchant_id}: no order ref in payload {payload}")
            return

        # Parse Shepherd reference format: "PX,<shepherd_order_id>,<pos_ticket_number>"
        # The last segment is the POS ticket number assigned by RPOWER after digesting the order.
        pos_ticket_number = None
        ref_mid_segment = None
        if isinstance(order_ref, str) and order_ref.startswith("PX,"):
            parts = order_ref.split(",")
            if len(parts) >= 3:
                ref_mid_segment = parts[1]
                last_part = parts[-1]
                if last_part.isdigit():
                    pos_ticket_number = int(last_part)

        # Try exact match first (shepherd_order_id stores the full ref string from submission)
        order = await db.orders.find_one(
            {"$or": [{"shepherd_order_id": order_ref}, {"shepherd_order_ref": order_ref}]},
            {"_id": 0}
        )

        # If not found, try matching by the middle segment (Shepherd order ID portion of the reference)
        if not order and ref_mid_segment:
            order = await db.orders.find_one(
                {"shepherd_order_id": {"$regex": re.escape(ref_mid_segment)}},
                {"_id": 0}
            )

        if not order:
            await db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "merchant_id": resolved_merchant_id,
                "action": "shepherd_orderstatusupdate_unmatched",
                "endpoint": f"/api/webhooks/shepherd/{shepherd_merchant_id}",
                "request_data": {
                    "shepherd_merchant_id": shepherd_merchant_id,
                    "order_ref": order_ref,
                    "reference_mid_segment": ref_mid_segment,
                    "status_raw": status_raw,
                    "parsed_pos_ticket_number": pos_ticket_number,
                    "payload": payload,
                },
                "status_code": 404,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.warning(f"ORDERSTATUSUPDATE: no order found for ref {order_ref} (merchant {shepherd_merchant_id})")
            return

        new_status = map_shepherd_status_to_internal(status_raw.lower(), order.get("status"))
        old_status = order.get("status")

        update_data = {
            "shepherd_status": status_raw,
            "shepherd_status_updated_at": datetime.now(timezone.utc).isoformat()
        }
        if new_status != old_status:
            update_data["status"] = new_status

        # Store POS ticket number on first receipt (don't overwrite once set)
        if pos_ticket_number is not None and not order.get("poscnx_ticket_number"):
            update_data["poscnx_ticket_number"] = pos_ticket_number

        await db.orders.update_one({"id": order["id"]}, {"$set": update_data})

        # Broadcast whenever status or ticket number changes so the frontend can update in real time
        status_changed = new_status != old_status
        ticket_arrived = pos_ticket_number is not None and not order.get("poscnx_ticket_number")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": order.get("merchant_id") or resolved_merchant_id,
            "action": "shepherd_orderstatusupdate_processed",
            "endpoint": f"/api/webhooks/shepherd/{shepherd_merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
                "order_ref": order_ref,
                "reference_mid_segment": ref_mid_segment,
                "status_raw": status_raw,
                "parsed_pos_ticket_number": pos_ticket_number,
                "payload": payload,
            },
            "response_data": {
                "order_id": order.get("id"),
                "order_number": order.get("order_number"),
                "old_status": old_status,
                "new_status": new_status,
                "status_changed": status_changed,
                "ticket_arrived": ticket_arrived,
                "stored_pos_ticket_number": update_data.get("poscnx_ticket_number", order.get("poscnx_ticket_number")),
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        if status_changed or ticket_arrived:
            updated_order = await db.orders.find_one({"id": order["id"]}, {"_id": 0})
            if updated_order:
                await ws_manager.broadcast_order_event(
                    f"order_status_{new_status}",
                    updated_order,
                    order["merchant_id"]
                )
        log_msg = f"Webhook: order {order['id'][:8]} status {old_status} -> {new_status}"
        if pos_ticket_number is not None:
            log_msg += f", POS ticket #{pos_ticket_number}"
        logger.info(log_msg)
    except Exception as e:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": resolved_merchant_id,
            "action": "shepherd_orderstatusupdate_failed",
            "endpoint": f"/api/webhooks/shepherd/{shepherd_merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
                "payload": payload,
            },
            "response_data": {
                "error": str(e),
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.error(f"Error handling ORDERSTATUSUPDATE webhook: {e}")


async def _handle_shepherd_menu_update(shepherd_merchant_id: str):
    """Handle MENUUPDATE webhook push from Shepherd — re-syncs menu for the merchant."""
    try:
        merchant = await db.merchants.find_one(
            {"shepherd_config.merchant_id": shepherd_merchant_id, "is_active": True},
            {"_id": 0, "id": 1, "shepherd_config": 1}
        )
        if not merchant:
            logger.warning(f"MENUUPDATE webhook: no active merchant for Shepherd ID {shepherd_merchant_id}")
            return

        shepherd = get_shepherd_client()
        if not shepherd:
            return

        merchant_id = merchant["id"]
        shepherd_menu = await shepherd.get_menu(shepherd_merchant_id)
        schedules_data = await shepherd.get_schedules(shepherd_merchant_id)
        schedules = schedules_data if isinstance(schedules_data, list) else schedules_data.get("schedules", [])

        transformed = transform_shepherd_menu_to_rnoo(
            shepherd_menu, merchant_id,
            shepherd_merchant_id=shepherd_merchant_id,
            rnoo_only=True, schedules=schedules
        )

        await db.menu_categories.delete_many({"merchant_id": merchant_id})
        await db.menu_items.delete_many({"merchant_id": merchant_id})

        if transformed["categories"]:
            for cat in transformed["categories"]:
                cat["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.menu_categories.insert_many(transformed["categories"])

        if transformed["items"]:
            for item in transformed["items"]:
                item["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.menu_items.insert_many(transformed["items"])

        await db.merchants.update_one(
            {"id": merchant_id},
            {"$set": {"last_menu_sync": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(
            f"Webhook menu re-sync complete for merchant {merchant_id}: "
            f"{len(transformed['categories'])} cats, {len(transformed['items'])} items"
        )
    except Exception as e:
        logger.error(f"Error handling MENUUPDATE webhook: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    global _background_sync_task

    logger.info("Application starting up...")

    # Start the background order status sync task
    _background_sync_task = asyncio.create_task(sync_order_statuses_background())
    logger.info("Background order status sync task started")

    # Subscribe to Shepherd webhook events if WEBHOOK_BASE_URL is set
    if WEBHOOK_BASE_URL and SHEPHERD_BEARER_TOKEN:
        asyncio.create_task(subscribe_shepherd_webhooks_on_startup())
        logger.info(f"Shepherd webhook subscription task started (base URL: {WEBHOOK_BASE_URL})")
    else:
        logger.info("WEBHOOK_BASE_URL not set — running in poll-only mode (set WEBHOOK_BASE_URL in .env to enable push webhooks)")

    yield
    
    # Shutdown
    logger.info("Application shutting down...")
    
    # Signal background task to stop
    _shutdown_event.set()
    
    # Wait for background task to finish (with timeout)
    if _background_sync_task:
        try:
            await asyncio.wait_for(_background_sync_task, timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Background sync task did not stop in time, cancelling...")
            _background_sync_task.cancel()
            try:
                await _background_sync_task
            except asyncio.CancelledError:
                pass
    
    # Close database connection
    client.close()
    logger.info("Shutdown complete")

# Create the main app
app = FastAPI(title="RPOWER Native Online Ordering API", version="1.0.0", lifespan=lifespan)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def parse_provider_payload(raw_body: bytes, content_type: str) -> dict:
    if not raw_body:
        return {}

    text_body = raw_body.decode("utf-8", errors="replace")

    if "json" in (content_type or ""):
        try:
            return {"raw_json": json.loads(text_body)}
        except json.JSONDecodeError:
            return {"raw_text": text_body}

    if "xml" in (content_type or "") or text_body.lstrip().startswith("<"):
        return {"raw_xml": text_body}

    return {"raw_text": text_body}


def extract_provider_name_from_path(path: str) -> str:
    normalized_path = path.lower()
    if "shepherd" in normalized_path:
        return "shepherd"
    if "xyzzy" in normalized_path or "poscnx" in normalized_path or "pos" in normalized_path:
        return "pos"
    return "unknown"


def extract_merchant_id_from_payload(payload: dict) -> Optional[str]:
    if not isinstance(payload, dict):
        return None

    for key in ("merchant_id", "merchantId", "shepherd_merchant_id", "shepherdMerchantId", "mid", "MID"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value

    raw_json = payload.get("raw_json")
    if isinstance(raw_json, dict):
        return extract_merchant_id_from_payload(raw_json)

    return None


def extract_shepherd_merchant_id_from_path(path: str) -> Optional[str]:
    match = re.search(r"/webhooks/shepherd/([^/?#]+)", path or "", re.IGNORECASE)
    if not match:
        return None
    return match.group(1)


async def resolve_local_merchant_id(merchant_identifier: Optional[str]) -> Optional[str]:
    """
    Resolve a merchant identifier to the local merchant id used by RBAC filters.
    Accepts either local merchant id or shepherd_config.merchant_id.
    """
    if not merchant_identifier:
        return None

    merchant = await db.merchants.find_one(
        {
            "$or": [
                {"id": merchant_identifier},
                {"shepherd_config.merchant_id": merchant_identifier},
            ]
        },
        {"_id": 0, "id": 1},
    )
    if merchant:
        return merchant.get("id")

    # Fallback to raw identifier so super-admins still get merchant context in logs.
    return merchant_identifier


def is_provider_webhook_path(path: str) -> bool:
    normalized_path = path.lower()
    return "webhook" in normalized_path or "provider-callback" in normalized_path or "pos-callback" in normalized_path


def build_menu_sync_summary(transformed: dict, shepherd_menu: Any, schedules: List[dict], tax_rates: Any, hqding_info: Any) -> dict:
    menu_records = shepherd_menu.get("Menus", []) if isinstance(shepherd_menu, dict) else []
    rnoo_menu_count = sum(1 for menu in menu_records if str(menu.get("MenuId", "")).upper().startswith("RNOO"))
    return {
        "menus_received": len(menu_records),
        "rnoo_menus_received": rnoo_menu_count,
        "categories_transformed": len(transformed.get("categories", [])),
        "items_transformed": len(transformed.get("items", [])),
        "modifier_groups_transformed": sum(len(item.get("modifier_groups", [])) for item in transformed.get("items", [])),
        "schedules_received": len(schedules),
        "tax_rates_received": len(tax_rates) if isinstance(tax_rates, list) else len(tax_rates.get("tax_rates", [])) if isinstance(tax_rates, dict) else 0,
        "hqding_received": bool(hqding_info),
    }


def normalize_tax_rate_value(raw_rate: Any) -> Optional[float]:
    """Normalize a tax rate to decimal fraction form (e.g., 5.0 -> 0.05)."""
    if raw_rate is None:
        return None
    try:
        value = float(raw_rate)
    except (TypeError, ValueError):
        return None

    if value < 0:
        return None

    # Shepherd commonly returns percent values (e.g., 5.0 means 5%).
    if value > 1:
        value = value / 100.0

    return round(value, 6)


def normalize_shepherd_tax_rates_payload(tax_rates_payload: Any) -> List[dict]:
    """Normalize Shepherd tax payloads to a stable internal format."""
    if isinstance(tax_rates_payload, dict):
        candidates = (
            tax_rates_payload.get("TaxRates")
            or tax_rates_payload.get("tax_rates")
            or tax_rates_payload.get("taxRates")
            or []
        )
    elif isinstance(tax_rates_payload, list):
        candidates = tax_rates_payload
    else:
        candidates = []

    normalized = []
    for tax in candidates:
        if not isinstance(tax, dict):
            continue

        # Menu Sync TaxRateId values correspond to Shepherd tax rate posId.
        tax_rate_id = (
            tax.get("posId")
            or tax.get("PosId")
            or tax.get("TaxRateId")
            or tax.get("Id")
            or tax.get("id")
        )
        if not tax_rate_id:
            continue

        normalized_rate = normalize_tax_rate_value(
            tax.get("Rate") if tax.get("Rate") is not None else tax.get("rate")
        )

        normalized.append(
            {
                "tax_rate_id": str(tax_rate_id),
                "name": tax.get("Name") or tax.get("name") or str(tax_rate_id),
                "rate": normalized_rate if normalized_rate is not None else 0.0,
                "included": bool(tax.get("Included") if tax.get("Included") is not None else tax.get("included", False)),
            }
        )

    return normalized


def resolve_default_tax_rate(normalized_tax_rates: List[dict]) -> Tuple[Optional[str], float]:
    """Pick a stable default tax rate when item-level mapping is missing."""
    if not normalized_tax_rates:
        return None, 0.0

    for row in normalized_tax_rates:
        if str(row.get("tax_rate_id", "")).lower() == "tax1":
            return row.get("tax_rate_id"), float(row.get("rate") or 0.0)

    for row in normalized_tax_rates:
        rate = float(row.get("rate") or 0.0)
        if rate > 0:
            return row.get("tax_rate_id"), rate

    first = normalized_tax_rates[0]
    return first.get("tax_rate_id"), float(first.get("rate") or 0.0)


@app.middleware("http")
async def capture_provider_webhook_payloads(request: Request, call_next):
    if not is_provider_webhook_path(request.url.path):
        return await call_next(request)

    raw_body = await request.body()
    content_type = request.headers.get("content-type", "")
    parsed_payload = parse_provider_payload(raw_body, content_type)

    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        payload_merchant_id = extract_merchant_id_from_payload(parsed_payload)
        path_merchant_id = extract_shepherd_merchant_id_from_path(request.url.path)
        resolved_merchant_id = await resolve_local_merchant_id(path_merchant_id or payload_merchant_id)

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": resolved_merchant_id,
            "action": "provider_webhook_received",
            "endpoint": request.url.path,
            "request_data": {
                "provider": extract_provider_name_from_path(request.url.path),
                "method": request.method,
                "payload_merchant_id": payload_merchant_id,
                "path_merchant_id": path_merchant_id,
                "content_type": content_type,
                "headers": {
                    "user-agent": request.headers.get("user-agent"),
                    "x-forwarded-for": request.headers.get("x-forwarded-for"),
                    "x-real-ip": request.headers.get("x-real-ip"),
                },
                **parsed_payload,
            },
            "status_code": status_code,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

# Basic health check (non-API path for external probes)
@app.get("/health")
async def health():
    try:
        # Attempt to ping MongoDB (will succeed even if using default localhost without active DB)
        await db.command("ping")
        return {"status": "ok", "mongo": "ok"}
    except Exception as e:
        # Service can still run without DB; report degraded state
        return {"status": "degraded", "mongo": "error", "detail": str(e)}


# ============== WEBSOCKET CONNECTION MANAGER ==============
class ConnectionManager:
    """Manages WebSocket connections for real-time order notifications"""
    
    def __init__(self):
        # Store connections by merchant_id for targeted notifications
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Store all admin connections (super_admin, reseller)
        self.admin_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket, merchant_id: Optional[str] = None, is_admin: bool = False):
        await websocket.accept()
        if is_admin:
            self.admin_connections.append(websocket)
            logger.info(f"Admin WebSocket connected. Total admin connections: {len(self.admin_connections)}")
        elif merchant_id:
            if merchant_id not in self.active_connections:
                self.active_connections[merchant_id] = []
            self.active_connections[merchant_id].append(websocket)
            logger.info(f"Merchant {merchant_id} WebSocket connected. Total connections: {len(self.active_connections[merchant_id])}")
    
    def disconnect(self, websocket: WebSocket, merchant_id: Optional[str] = None, is_admin: bool = False):
        if is_admin and websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
            logger.info(f"Admin WebSocket disconnected. Remaining: {len(self.admin_connections)}")
        elif merchant_id and merchant_id in self.active_connections:
            if websocket in self.active_connections[merchant_id]:
                self.active_connections[merchant_id].remove(websocket)
                logger.info(f"Merchant {merchant_id} WebSocket disconnected. Remaining: {len(self.active_connections[merchant_id])}")
    
    async def broadcast_to_merchant(self, merchant_id: str, message: dict):
        """Send message to all connections for a specific merchant"""
        if merchant_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[merchant_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to merchant {merchant_id}: {e}")
                    disconnected.append(connection)
            # Clean up disconnected
            for conn in disconnected:
                self.active_connections[merchant_id].remove(conn)
    
    async def broadcast_to_admins(self, message: dict):
        """Send message to all admin connections"""
        disconnected = []
        for connection in self.admin_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to admin: {e}")
                disconnected.append(connection)
        # Clean up disconnected
        for conn in disconnected:
            self.admin_connections.remove(conn)
    
    async def broadcast_order_event(self, event_type: str, order: dict, merchant_id: str):
        """Broadcast order event to relevant parties"""
        message = {
            "type": event_type,
            "order": order,
            "merchant_id": merchant_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        # Send to merchant
        await self.broadcast_to_merchant(merchant_id, message)
        # Send to all admins
        await self.broadcast_to_admins(message)


# Global connection manager instance
ws_manager = ConnectionManager()

# ============== ENUMS ==============
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    RESELLER = "reseller"
    MERCHANT = "merchant"
    CONSUMER = "consumer"

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class DeliveryType(str, Enum):
    DELIVERY = "DELIVERY"
    TAKEOUT = "TAKEOUT"
    DINEIN = "DINEIN"

class OrderTimingType(str, Enum):
    ASAP = "ASAP"                    # Immediate order
    ADVANCE = "ADVANCE"              # Same day, different time
    FUTURE = "FUTURE"                # Different day, different time

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

# ============== MODELS ==============
class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    phone: str
    name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    reseller_id: Optional[str] = None
    merchant_id: Optional[str] = None
    merchant_ids: Optional[List[str]] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reseller_id: Optional[str] = None
    merchant_id: Optional[str] = None
    merchant_ids: Optional[List[str]] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    password: str


class AdminPasswordResetRequest(BaseModel):
    user_id: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# Reseller Model
class ResellerBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    company_name: Optional[str] = None

class ResellerCreate(ResellerBase):
    pass

class Reseller(ResellerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_active: bool = True
    merchant_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Merchant/Location Model
class StoreHours(BaseModel):
    day: str
    open_time: str
    close_time: str
    is_closed: bool = False

class BrandingSettings(BaseModel):
    logo_url: Optional[str] = None
    primary_color: str = "#7C3AED"
    secondary_color: str = "#111827"
    font_family: str = "Manrope"
    banner_url: Optional[str] = None

class ShepherdConfig(BaseModel):
    merchant_id: str
    clerk_id: Optional[str] = None
    profit_center: Optional[str] = None
    concept_id: Optional[str] = None
    api_endpoint: Optional[str] = None
    bearer_token: Optional[str] = None
    rpower_cg: Optional[str] = None  # RPOWER Customer Group for Core API

class LicenseInfo(BaseModel):
    """License information from Shepherd API"""
    license_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    logo_url: Optional[str] = None

class MerchantBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    slug: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    phone: str
    email: Optional[EmailStr] = None
    description: Optional[str] = None
    price_bump_percentage: float = 0.0
    price_bump_fixed: float = 0.0
    frontend_template: str = "classic"

class MerchantCreate(MerchantBase):
    reseller_id: str
    shepherd_config: Optional[ShepherdConfig] = None

class Merchant(MerchantBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reseller_id: str
    is_active: bool = True
    is_open: bool = True
    store_hours: List[StoreHours] = []
    branding: BrandingSettings = Field(default_factory=BrandingSettings)
    shepherd_config: Optional[ShepherdConfig] = None
    license_info: Optional[LicenseInfo] = None
    license_id: Optional[str] = None
    last_menu_sync: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Menu Models
class ModifierOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    plu: Optional[str] = None
    shepherd_pos_id: Optional[str] = None
    shepherd_mid: Optional[str] = None
    price: float = 0.0
    is_default: bool = False
    allow_duplicates: bool = False  # For prefix modifiers like "NO~"

class ModifierGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    min_selections: int = 0
    max_selections: int = 1
    is_required: bool = False
    options: List[ModifierOption] = []

class MenuItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    modifier_groups: List[ModifierGroup] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Shepherd-specific fields
    shepherd_mid: Optional[str] = None  # Main identifier from Shepherd
    plu: Optional[str] = None  # PLU value
    pos_id: Optional[str] = None  # POS identifier
    pos_data: Optional[str] = None  # Custom key:value pairs
    tax_rate_id: Optional[str] = None  # Tax table identifier
    tax_rate_percent: Optional[float] = None  # Decimal tax rate (e.g., 0.05)
    merchant_default_tax_rate_percent: Optional[float] = None

class MenuItemCreate(BaseModel):
    merchant_id: str
    category_id: str
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    modifier_groups: List[ModifierGroup] = []
    shepherd_mid: Optional[str] = None
    plu: Optional[str] = None
    pos_id: Optional[str] = None
    pos_data: Optional[str] = None
    tax_rate_id: Optional[str] = None
    tax_rate_percent: Optional[float] = None
    merchant_default_tax_rate_percent: Optional[float] = None

class MenuCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    name: str
    description: Optional[str] = None
    display_order: int = 0
    image_url: Optional[str] = None
    is_active: bool = True
    # Schedule fields for time-based menu filtering
    schedule_id: Optional[str] = None  # Direct reference to Shepherd schedule ID
    schedule_name: Optional[str] = None  # e.g., "Happy Hour", "Breakfast"
    schedule_days: Optional[str] = None  # e.g., "NYYYYYN" (Mon-Fri)
    schedule_start: Optional[str] = None  # e.g., "10:00"
    schedule_end: Optional[str] = None    # e.g., "16:00"
    # Shepherd-specific fields
    shepherd_menu_id: Optional[str] = None  # Track source menu from Shepherd
    tax_rate_id: Optional[str] = None  # Tax table for this menu/category
    shepherd_pos_id: Optional[str] = None  # POS identifier

class MenuCategoryCreate(BaseModel):
    merchant_id: str
    name: str
    description: Optional[str] = None
    display_order: int = 0
    image_url: Optional[str] = None
    schedule_id: Optional[str] = None
    schedule_name: Optional[str] = None
    schedule_days: Optional[str] = None
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    tax_rate_id: Optional[str] = None

# Cart/Order Models
class CartItemModifier(BaseModel):
    group_id: str
    group_name: str
    option_id: str
    option_name: str
    price: float = 0.0
    plu: Optional[str] = None
    shepherd_pos_id: Optional[str] = None

class CartItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    menu_item_id: str
    name: str
    quantity: int = 1
    unit_price: float
    plu: Optional[str] = None
    shepherd_pos_id: Optional[str] = None
    tax_rate_id: Optional[str] = None
    tax_rate_percent: Optional[float] = None
    modifiers: List[CartItemModifier] = []
    special_instructions: Optional[str] = None

    @property
    def total_price(self) -> float:
        modifier_total = sum(m.price for m in self.modifiers)
        return (self.unit_price + modifier_total) * self.quantity

class CustomerInfo(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

class PaymentInfo(BaseModel):
    method: str = "mock_card"
    card_last_four: Optional[str] = None
    amount: float
    tip: float = 0.0
    status: PaymentStatus = PaymentStatus.PENDING

class OrderCreate(BaseModel):
    merchant_id: str
    customer: CustomerInfo
    delivery_type: DeliveryType
    items: List[CartItem]
    payment: PaymentInfo
    # Order timing fields
    order_timing: OrderTimingType = OrderTimingType.ASAP
    scheduled_date: Optional[str] = None  # ISO date string (YYYY-MM-DD)
    scheduled_time: Optional[str] = None  # Time string (HH:MM)
    notes: Optional[str] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    merchant_id: str
    order_number: int
    customer: CustomerInfo
    delivery_type: DeliveryType
    items: List[CartItem]
    subtotal: float
    tax: float
    tip: float = 0.0
    total: float
    payment: PaymentInfo
    status: OrderStatus = OrderStatus.PENDING
    # Order timing fields
    order_timing: OrderTimingType = OrderTimingType.ASAP
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    need_datetime: Optional[str] = None  # Combined datetime for Shepherd (RFC3339)
    notes: Optional[str] = None
    poscnx_ref: Optional[str] = None
    poscnx_ticket_number: Optional[int] = None
    # Shepherd/POS Integration fields
    shepherd_submitted: Optional[bool] = None
    shepherd_response: Optional[dict] = None
    shepherd_error: Optional[str] = None
    shepherd_submitted_at: Optional[str] = None
    shepherd_attempted_at: Optional[str] = None
    shepherd_order_ref: Optional[str] = None  # Reference ID returned by Shepherd
    shepherd_order_id: Optional[str] = None   # Shepherd's internal order ID
    shepherd_status: Optional[str] = None     # Status from Shepherd/POS
    shepherd_status_updated_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UpsellSuggestionRequest(BaseModel):
    cart_item_ids: List[str] = []
    customer_email: Optional[str] = None
    limit: int = 4


class UpsellEventCreate(BaseModel):
    merchant_id: str
    event_type: str
    source: str = "unknown"
    suggestion_item_id: Optional[str] = None
    suggestion_item_name: Optional[str] = None
    suggestion_category_id: Optional[str] = None
    suggestion_category_name: Optional[str] = None
    trigger_item_ids: List[str] = []
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = {}

# Audit Log
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    merchant_id: Optional[str] = None
    action: str
    endpoint: str
    request_data: Optional[dict] = None
    response_data: Optional[dict] = None
    status_code: int
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== AUTH HELPERS ==============
PASSWORD_POLICY_MESSAGE = "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character"


def build_full_name(first_name: str, last_name: str) -> str:
    return f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()


def split_name(full_name: Optional[str]) -> tuple[str, str]:
    parts = str(full_name or "").strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def enforce_required_user_profile_fields(first_name: str, last_name: str, phone: str):
    if not (first_name or "").strip():
        raise HTTPException(status_code=400, detail="First name is required")
    if not (last_name or "").strip():
        raise HTTPException(status_code=400, detail="Last name is required")
    if not (phone or "").strip():
        raise HTTPException(status_code=400, detail="Phone number is required")


def normalize_merchant_ids(raw_ids: Optional[List[str]]) -> List[str]:
    ids: List[str] = []
    for value in raw_ids or []:
        normalized = str(value or "").strip()
        if normalized and normalized not in ids:
            ids.append(normalized)
    return ids


async def get_all_merchant_ids() -> List[str]:
    merchants = await db.merchants.find({}, {"_id": 0, "id": 1}).to_list(5000)
    return [str(merchant.get("id")) for merchant in merchants if merchant.get("id")]


def enforce_password_policy(password: str):
    if len(password or "") < 8:
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# ============== POSCNX XML BUILDER ==============
def build_poscnx_order_xml(order: Order, merchant: dict) -> str:
    """Build POSCNX XML format order for Shepherd/RPOWER"""
    root = ET.Element("XyzzyTalk")
    
    header = ET.SubElement(root, "XyzzyHeader")
    header.set("xyzzy_version", "0.1.1.0")
    header.set("api_id", "POSCNX")
    header.set("api_version", "0.0.9.0")
    header.set("api_command", "ORDER")
    
    pcx_order = ET.SubElement(root, "PCX_ORDER")
    pcx_order.set("ref", f"RNOO-{order.id[:8]}")
    
    # Customer
    customer = ET.SubElement(pcx_order, "Customer")
    customer.set("n", order.customer.name)
    
    addr = ET.SubElement(customer, "Addr")
    if order.customer.address_line1:
        addr.set("l1", order.customer.address_line1)
    if order.customer.address_line2:
        addr.set("l2", order.customer.address_line2)
    if order.customer.city:
        addr.set("c", order.customer.city)
    if order.customer.state:
        addr.set("s", order.customer.state)
    if order.customer.zip_code:
        addr.set("z", order.customer.zip_code)
    addr.set("cc", "US")
    
    ctct = ET.SubElement(customer, "Ctct")
    ctct.set("ph", order.customer.phone)
    ctct.set("eml", order.customer.email)
    
    # Ticket
    ticket = ET.SubElement(pcx_order, "Ticket")
    ticket.set("ref", str(order.order_number))
    ticket.set("dt", order.created_at.strftime("%Y-%m-%dT%H:%M"))
    ticket.set("dlvt", order.delivery_type.value)
    if order.scheduled_time:
        ticket.set("need_dt", order.scheduled_time.strftime("%Y-%m-%dT%H:%M"))
    if order.notes:
        ticket.set("note", order.notes)
    ticket.set("gttl", f"$US{order.total:.2f}")
    
    # Items
    for item in order.items:
        item_el = ET.SubElement(ticket, "Item")
        item_el.set("n", item.name)
        item_el.set("qty", str(item.quantity))
        item_el.set("p", f"$US{item.unit_price:.2f}")
        
        modifier_total = sum(m.price for m in item.modifiers)
        item_el.set("ttl", f"$US{(item.unit_price + modifier_total) * item.quantity:.2f}")
        
        if item.special_instructions:
            item_el.set("note", item.special_instructions)
        
        # Modifiers
        for mod in item.modifiers:
            mod_group = ET.SubElement(item_el, "Mod")
            mod_group.set("n", mod.group_name)
            mod_option = ET.SubElement(mod_group, "Mod")
            mod_option.set("n", mod.option_name)
            if mod.price > 0:
                mod_option.set("p", f"$US{mod.price:.2f}")
    
    # Tax
    tax_item = ET.SubElement(ticket, "Item")
    tax_item.set("plu", "TAX")
    tax_item.set("p", f"$US{order.tax:.2f}")
    
    # Payment
    payment = ET.SubElement(ticket, "Payment")
    payment.set("pmid", "ONLINE")
    payment.set("paid", "1")
    payment.set("amt", f"$US{order.total:.2f}")
    if order.tip > 0:
        payment.set("tip", f"{order.tip:.2f}")
    
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


# ============== AUDIT LOGGING HELPER ==============
async def log_audit(
    action: str,
    endpoint: str,
    user: dict = None,
    merchant_id: str = None,
    request_data: dict = None,
    response_data: dict = None,
    status_code: int = 200
):
    """
    Helper function to create consistent audit log entries.
    """
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id") if user else None,
        "user_email": user.get("email") if user else None,
        "user_role": user.get("role") if user else None,
        "merchant_id": merchant_id,
        "action": action,
        "endpoint": endpoint,
        "request_data": request_data or {},
        "response_data": response_data or {},
        "status_code": status_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def get_accessible_merchant_ids(user: dict) -> Optional[List[str]]:
    """Return merchant ids visible to the current user, or None for full access."""
    role = user.get("role")

    if role == UserRole.SUPER_ADMIN.value:
        return None

    if role in [UserRole.MERCHANT.value, UserRole.CONSUMER.value]:
        ids = normalize_merchant_ids(user.get("merchant_ids") or [])
        single_id = str(user.get("merchant_id") or "").strip()
        if single_id and single_id not in ids:
            ids.append(single_id)
        return ids

    if role == UserRole.RESELLER.value:
        explicit_ids = normalize_merchant_ids(user.get("merchant_ids") or [])
        if explicit_ids:
            return explicit_ids

        reseller_merchants = await db.merchants.find(
            {"reseller_id": user.get("reseller_id")},
            {"_id": 0, "id": 1}
        ).to_list(1000)
        return [merchant["id"] for merchant in reseller_merchants]

    return []


def build_order_integration_log_payload(
    order_data: dict,
    merchant: dict,
    shepherd_merchant_id: Optional[str] = None,
    shepherd_order: Optional[dict] = None,
    used_shepherd_ref: Optional[str] = None
) -> dict:
    """Build a structured payload with provider JSON and generated POSCNX XML."""
    payload = {
        "order_id": order_data.get("id"),
        "order_number": order_data.get("order_number"),
        "merchant_id": order_data.get("merchant_id"),
        "merchant_name": merchant.get("name"),
        "shepherd_merchant_id": shepherd_merchant_id,
        "used_shepherd_ref": used_shepherd_ref,
        "poscnx_ref": order_data.get("poscnx_ref"),
        "poscnx_ticket_number": order_data.get("poscnx_ticket_number"),
    }

    if shepherd_order is not None:
        payload["provider_order_json"] = shepherd_order

    try:
        payload["xyzzytalk_poscnx_xml"] = build_poscnx_order_xml(Order.model_validate(order_data), merchant)
    except Exception as exc:
        payload["xyzzytalk_poscnx_xml_error"] = str(exc)

    return payload


# ============== AUTH ENDPOINTS ==============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    normalized_email = str(user_data.email).strip().lower()
    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    enforce_required_user_profile_fields(
        user_data.first_name,
        user_data.last_name,
        user_data.phone,
    )
    enforce_password_policy(user_data.password)
    
    user_dict = user_data.model_dump()
    user_dict["email"] = normalized_email
    user_dict["first_name"] = user_data.first_name.strip()
    user_dict["last_name"] = user_data.last_name.strip()
    user_dict["phone"] = user_data.phone.strip()
    user_dict["name"] = build_full_name(user_data.first_name, user_data.last_name)

    merchant_ids = normalize_merchant_ids(user_data.merchant_ids)
    if user_data.merchant_id:
        single_merchant_id = str(user_data.merchant_id).strip()
        if single_merchant_id and single_merchant_id not in merchant_ids:
            merchant_ids.append(single_merchant_id)

    if user_data.role == UserRole.SUPER_ADMIN:
        all_merchant_ids = await get_all_merchant_ids()
        user_dict["merchant_ids"] = all_merchant_ids
        user_dict["merchant_id"] = all_merchant_ids[0] if all_merchant_ids else None
    else:
        if merchant_ids:
            existing_merchants = await db.merchants.find({"id": {"$in": merchant_ids}}, {"_id": 0, "id": 1}).to_list(1000)
            if len(existing_merchants) != len(merchant_ids):
                raise HTTPException(status_code=400, detail="One or more selected merchants were not found")

    if user_data.role == UserRole.MERCHANT:
        if not merchant_ids:
            raise HTTPException(status_code=400, detail="Merchant users must be assigned to at least one merchant")
        user_dict["merchant_ids"] = merchant_ids
        user_dict["merchant_id"] = merchant_ids[0]
    elif user_data.role != UserRole.SUPER_ADMIN:
        user_dict["merchant_ids"] = merchant_ids
        user_dict["merchant_id"] = merchant_ids[0] if merchant_ids else None

    if user_data.role not in [UserRole.SUPER_ADMIN, UserRole.MERCHANT, UserRole.RESELLER, UserRole.CONSUMER]:
        user_dict["merchant_ids"] = []
        user_dict["merchant_id"] = None

    user_dict["password"] = hash_password(user_data.password)
    user_dict["id"] = str(uuid.uuid4())
    user_dict["is_active"] = True
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user_dict["id"], user_dict["role"], user_dict["email"])
    user_response = {k: v for k, v in user_dict.items() if k != "password"}
    
    # Log registration
    await log_audit(
        action="user_registered",
        endpoint="/api/auth/register",
        user=user_response,
        request_data={"email": user_data.email, "role": user_data.role}
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    normalized_email = str(credentials.email).strip().lower()
    user = await db.users.find_one({"email": normalized_email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        # Log failed login attempt
        await log_audit(
            action="login_failed",
            endpoint="/api/auth/login",
            request_data={"email": credentials.email},
            status_code=401
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    token = create_token(user["id"], user["role"], user["email"])
    user_response = {k: v for k, v in user.items() if k != "password"}
    
    # Log successful login
    await log_audit(
        action="login_success",
        endpoint="/api/auth/login",
        user=user_response,
        request_data={"email": credentials.email}
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

# ============== USER MANAGEMENT ENDPOINTS ==============
@api_router.get("/users", response_model=List[dict])
async def list_users(
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """List all users - admin only"""
    users_list = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users_list

@api_router.get("/users/{user_id}", response_model=dict)
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user by ID - users can view themselves, admins can view anyone"""
    if current_user["id"] != user_id and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.post("/users", response_model=dict)
async def create_user(
    data: UserCreate,
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Create a new user - admin only"""
    normalized_email = str(data.email).strip().lower()
    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    enforce_required_user_profile_fields(data.first_name, data.last_name, data.phone)
    enforce_password_policy(data.password)
    
    user_dict = data.model_dump()
    user_dict["email"] = normalized_email
    user_dict["first_name"] = data.first_name.strip()
    user_dict["last_name"] = data.last_name.strip()
    user_dict["phone"] = data.phone.strip()
    user_dict["name"] = build_full_name(data.first_name, data.last_name)

    merchant_ids = normalize_merchant_ids(data.merchant_ids)
    if data.merchant_id:
        single_merchant_id = str(data.merchant_id).strip()
        if single_merchant_id and single_merchant_id not in merchant_ids:
            merchant_ids.append(single_merchant_id)

    if data.role == UserRole.SUPER_ADMIN:
        all_merchant_ids = await get_all_merchant_ids()
        user_dict["merchant_ids"] = all_merchant_ids
        user_dict["merchant_id"] = all_merchant_ids[0] if all_merchant_ids else None
    else:
        if merchant_ids:
            existing_merchants = await db.merchants.find({"id": {"$in": merchant_ids}}, {"_id": 0, "id": 1}).to_list(1000)
            if len(existing_merchants) != len(merchant_ids):
                raise HTTPException(status_code=400, detail="One or more selected merchants were not found")

    if data.role == UserRole.MERCHANT:
        if not merchant_ids:
            raise HTTPException(status_code=400, detail="Merchant users must be assigned to at least one merchant")
        user_dict["merchant_ids"] = merchant_ids
        user_dict["merchant_id"] = merchant_ids[0]
    elif data.role != UserRole.SUPER_ADMIN:
        user_dict["merchant_ids"] = merchant_ids
        user_dict["merchant_id"] = merchant_ids[0] if merchant_ids else None

    if data.role not in [UserRole.SUPER_ADMIN, UserRole.MERCHANT, UserRole.RESELLER, UserRole.CONSUMER]:
        user_dict["merchant_ids"] = []
        user_dict["merchant_id"] = None

    user_dict["password"] = hash_password(data.password)
    user_dict["id"] = str(uuid.uuid4())
    user_dict["is_active"] = True
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Log user creation
    await log_audit(
        action="user_created",
        endpoint="/api/users",
        user=admin_user,
        request_data={"email": data.email, "role": data.role}
    )
    
    user_response = {k: v for k, v in user_dict.items() if k != "password"}
    return user_response

@api_router.put("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: str,
    updates: dict,
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update user - admin only"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Protect certain fields
    protected_fields = ["id", "created_at", "password"]
    for field in protected_fields:
        updates.pop(field, None)

    if "email" in updates:
        new_email = str(updates.get("email") or "").strip().lower()
        if not new_email:
            raise HTTPException(status_code=400, detail="Email is required")
        if new_email != str(user.get("email") or "").lower():
            existing_email_user = await db.users.find_one({"email": new_email}, {"_id": 0, "id": 1})
            if existing_email_user and existing_email_user.get("id") != user_id:
                raise HTTPException(status_code=400, detail="Email already registered")
        updates["email"] = new_email

    if "first_name" in updates:
        updates["first_name"] = str(updates.get("first_name") or "").strip()
    if "last_name" in updates:
        updates["last_name"] = str(updates.get("last_name") or "").strip()
    if "phone" in updates:
        updates["phone"] = str(updates.get("phone") or "").strip()

    if "merchant_ids" in updates:
        updates["merchant_ids"] = normalize_merchant_ids(updates.get("merchant_ids") or [])
    if "merchant_id" in updates:
        updates["merchant_id"] = str(updates.get("merchant_id") or "").strip() or None

    existing_first_name = user.get("first_name")
    existing_last_name = user.get("last_name")
    if not existing_first_name or not existing_last_name:
        fallback_first, fallback_last = split_name(user.get("name"))
        existing_first_name = existing_first_name or fallback_first
        existing_last_name = existing_last_name or fallback_last

    final_first_name = updates.get("first_name", existing_first_name)
    final_last_name = updates.get("last_name", existing_last_name)
    final_phone = updates.get("phone", user.get("phone"))
    enforce_required_user_profile_fields(final_first_name, final_last_name, final_phone)
    updates["name"] = build_full_name(final_first_name, final_last_name)

    current_merchant_ids = normalize_merchant_ids(user.get("merchant_ids") or [])
    current_single_merchant_id = str(user.get("merchant_id") or "").strip()
    if current_single_merchant_id and current_single_merchant_id not in current_merchant_ids:
        current_merchant_ids.append(current_single_merchant_id)

    final_role = updates.get("role", user.get("role"))
    final_merchant_ids = updates.get("merchant_ids", current_merchant_ids)

    if updates.get("merchant_id"):
        selected_single = updates["merchant_id"]
        final_merchant_ids = [selected_single] + [m for m in final_merchant_ids if m != selected_single]

    final_merchant_ids = normalize_merchant_ids(final_merchant_ids)

    if final_role == UserRole.SUPER_ADMIN.value:
        all_merchant_ids = await get_all_merchant_ids()
        updates["merchant_ids"] = all_merchant_ids
        updates["merchant_id"] = all_merchant_ids[0] if all_merchant_ids else None
    else:
        if final_merchant_ids:
            existing_merchants = await db.merchants.find({"id": {"$in": final_merchant_ids}}, {"_id": 0, "id": 1}).to_list(1000)
            if len(existing_merchants) != len(final_merchant_ids):
                raise HTTPException(status_code=400, detail="One or more selected merchants were not found")

    if final_role == UserRole.MERCHANT.value:
        if not final_merchant_ids:
            raise HTTPException(status_code=400, detail="Merchant users must be assigned to at least one merchant")
        updates["merchant_ids"] = final_merchant_ids
        updates["merchant_id"] = final_merchant_ids[0]
    elif final_role != UserRole.SUPER_ADMIN.value:
        updates["merchant_ids"] = final_merchant_ids
        updates["merchant_id"] = final_merchant_ids[0] if final_merchant_ids else None

    if final_role not in [
        UserRole.SUPER_ADMIN.value,
        UserRole.MERCHANT.value,
        UserRole.RESELLER.value,
        UserRole.CONSUMER.value,
    ]:
        updates["merchant_ids"] = []
        updates["merchant_id"] = None
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log user update
    await log_audit(
        action="user_updated",
        endpoint=f"/api/users/{user_id}",
        user=admin_user,
        request_data={"updated_fields": list(updates.keys())}
    )
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user


async def _reset_user_password_internal(user_id: str, password: str, admin_user: dict):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enforce_password_policy(password)

    if verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password": hash_password(password),
            "password_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    await log_audit(
        action="user_password_reset",
        endpoint=f"/api/users/{user_id}/reset-password",
        user=admin_user,
        request_data={"target_user_id": user_id, "target_email": user.get("email")}
    )

    return {"message": "Password reset successfully"}


@api_router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    payload: PasswordResetRequest,
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Reset user password - admin only"""
    return await _reset_user_password_internal(user_id, payload.password, admin_user)


@api_router.post("/users/reset-password")
async def reset_user_password_by_body(
    payload: AdminPasswordResetRequest,
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Reset user password via body payload - admin only."""
    return await _reset_user_password_internal(payload.user_id, payload.password, admin_user)


@api_router.post("/users/migrate-required-fields")
async def migrate_user_required_fields(
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Backfill first/last name and normalize email for legacy user records."""
    users_list = await db.users.find({}, {"_id": 0}).to_list(5000)
    all_merchant_ids = await get_all_merchant_ids()
    updated_count = 0
    missing_phone_user_ids = []

    for user in users_list:
        user_id = user.get("id")
        if not user_id:
            continue

        updates = {}

        existing_first_name = str(user.get("first_name") or "").strip()
        existing_last_name = str(user.get("last_name") or "").strip()

        if not existing_first_name or not existing_last_name:
            fallback_first, fallback_last = split_name(user.get("name"))
            if not existing_first_name and fallback_first:
                updates["first_name"] = fallback_first
                existing_first_name = fallback_first
            if not existing_last_name and fallback_last:
                updates["last_name"] = fallback_last
                existing_last_name = fallback_last

        full_name = build_full_name(existing_first_name, existing_last_name)
        if full_name and str(user.get("name") or "").strip() != full_name:
            updates["name"] = full_name

        email = str(user.get("email") or "").strip()
        normalized_email = email.lower()
        if email and normalized_email != email:
            updates["email"] = normalized_email

        phone = str(user.get("phone") or "").strip()
        if not phone:
            missing_phone_user_ids.append(user_id)

        merchant_ids = normalize_merchant_ids(user.get("merchant_ids") or [])
        single_merchant_id = str(user.get("merchant_id") or "").strip()
        if single_merchant_id and single_merchant_id not in merchant_ids:
            merchant_ids.append(single_merchant_id)
        if merchant_ids != normalize_merchant_ids(user.get("merchant_ids") or []):
            updates["merchant_ids"] = merchant_ids

        if user.get("role") == UserRole.SUPER_ADMIN.value:
            updates["merchant_ids"] = all_merchant_ids
            updates["merchant_id"] = all_merchant_ids[0] if all_merchant_ids else None
        elif user.get("role") != UserRole.MERCHANT.value:
            if user.get("merchant_id") is not None:
                updates["merchant_id"] = None
            if user.get("merchant_ids") not in ([], None):
                updates["merchant_ids"] = []
        elif merchant_ids:
            updates["merchant_id"] = merchant_ids[0]

        if updates:
            await db.users.update_one({"id": user_id}, {"$set": updates})
            updated_count += 1

    await log_audit(
        action="users_required_fields_migrated",
        endpoint="/api/users/migrate-required-fields",
        user=admin_user,
        request_data={
            "updated_count": updated_count,
            "missing_phone_count": len(missing_phone_user_ids),
        },
    )

    return {
        "message": "User profile migration completed",
        "updated_count": updated_count,
        "missing_phone_count": len(missing_phone_user_ids),
        "missing_phone_user_ids": missing_phone_user_ids,
    }

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Delete a user - admin only"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.delete_one({"id": user_id})
    
    # Log user deletion
    await log_audit(
        action="user_deleted",
        endpoint=f"/api/users/{user_id}",
        user=admin_user,
        request_data={"email": user.get("email"), "role": user.get("role")}
    )
    
    return {"message": f"User '{user.get('name')}' has been deleted"}

# ============== RESELLER ENDPOINTS ==============
@api_router.post("/resellers", response_model=Reseller)
async def create_reseller(
    data: ResellerCreate,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    reseller = Reseller(**data.model_dump())
    doc = reseller.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.resellers.insert_one(doc)
    
    # Log reseller creation
    await log_audit(
        action="reseller_created",
        endpoint="/api/resellers",
        user=user,
        request_data={"name": data.name, "email": data.email, "reseller_id": reseller.id}
    )
    
    return reseller

@api_router.get("/resellers", response_model=List[Reseller])
async def list_resellers(
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    resellers = await db.resellers.find({}, {"_id": 0}).to_list(1000)
    return resellers

@api_router.get("/resellers/{reseller_id}", response_model=Reseller)
async def get_reseller(
    reseller_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    reseller = await db.resellers.find_one({"id": reseller_id}, {"_id": 0})
    if not reseller:
        raise HTTPException(status_code=404, detail="Reseller not found")
    return reseller

@api_router.put("/resellers/{reseller_id}", response_model=Reseller)
async def update_reseller(
    reseller_id: str,
    updates: dict,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update reseller information"""
    reseller = await db.resellers.find_one({"id": reseller_id}, {"_id": 0})
    if not reseller:
        raise HTTPException(status_code=404, detail="Reseller not found")
    
    # Protect certain fields
    updates.pop("id", None)
    updates.pop("created_at", None)
    
    result = await db.resellers.update_one(
        {"id": reseller_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reseller not found")
    
    # Log reseller update
    await log_audit(
        action="reseller_updated",
        endpoint=f"/api/resellers/{reseller_id}",
        user=user,
        request_data={"updated_fields": list(updates.keys())}
    )
    
    updated_reseller = await db.resellers.find_one({"id": reseller_id}, {"_id": 0})
    return updated_reseller

@api_router.delete("/resellers/{reseller_id}")
async def delete_reseller(
    reseller_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Delete a reseller and all associated data"""
    reseller = await db.resellers.find_one({"id": reseller_id}, {"_id": 0})
    if not reseller:
        raise HTTPException(status_code=404, detail="Reseller not found")
    
    # Delete all merchants for this reseller
    merchants = await db.merchants.find({"reseller_id": reseller_id}, {"_id": 0}).to_list(1000)
    for merchant in merchants:
        # Delete all associated data
        await db.menu_categories.delete_many({"merchant_id": merchant["id"]})
        await db.menu_items.delete_many({"merchant_id": merchant["id"]})
        await db.orders.delete_many({"merchant_id": merchant["id"]})
    
    # Delete merchants
    await db.merchants.delete_many({"reseller_id": reseller_id})
    
    # Delete reseller
    await db.resellers.delete_one({"id": reseller_id})
    
    # Log reseller deletion
    await log_audit(
        action="reseller_deleted",
        endpoint=f"/api/resellers/{reseller_id}",
        user=user,
        request_data={"name": reseller.get("name"), "merchants_deleted": len(merchants)}
    )
    
    return {"message": f"Reseller '{reseller.get('name')}' and all associated data have been deleted"}

# ============== MERCHANT ENDPOINTS ==============
@api_router.post("/merchants", response_model=Merchant)
async def create_merchant(
    data: MerchantCreate,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    # Check if slug is unique
    existing = await db.merchants.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Merchant slug already exists")
    
    # If reseller, can only create merchants for their own reseller account
    if user["role"] == UserRole.RESELLER.value:
        user_reseller_id = user.get("reseller_id")
        if not user_reseller_id:
            raise HTTPException(status_code=403, detail="Reseller account not configured")
        if data.reseller_id != user_reseller_id:
            raise HTTPException(status_code=403, detail="Can only create merchants for your own reseller account")

    # Validate reseller exists before creating merchant
    reseller = await db.resellers.find_one({"id": data.reseller_id}, {"_id": 0})
    if not reseller:
        raise HTTPException(status_code=400, detail="Reseller not found")
    
    merchant = Merchant(**data.model_dump())
    
    # Default store hours
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    merchant.store_hours = [
        StoreHours(day=d, open_time="09:00", close_time="21:00", is_closed=(d == "Sunday"))
        for d in days
    ]
    
    doc = merchant.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.merchants.insert_one(doc)
    
    # Update reseller merchant count
    await db.resellers.update_one(
        {"id": data.reseller_id},
        {"$inc": {"merchant_count": 1}}
    )
    
    # Log merchant creation
    await log_audit(
        action="merchant_created",
        endpoint="/api/merchants",
        user=user,
        merchant_id=merchant.id,
        request_data={
            "name": data.name,
            "slug": data.slug,
            "reseller_id": data.reseller_id,
            "shepherd_merchant_id": data.shepherd_config.merchant_id if data.shepherd_config else None
        }
    )
    
    return merchant

# Public endpoint for listing active merchants (for homepage)
@api_router.get("/merchants/public", response_model=List[Merchant])
async def list_public_merchants():
    """Public endpoint to list active merchants for consumers"""
    merchants = await db.merchants.find({"is_active": True}, {"_id": 0}).to_list(100)
    return merchants

@api_router.get("/merchants", response_model=List[Merchant])
async def list_merchants(
    reseller_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user["role"] == UserRole.MERCHANT.value:
        # Merchants can only see their own merchant
        merchant_ids = current_user.get("merchant_ids", [])
        if not merchant_ids:
            return []
        query["id"] = {"$in": merchant_ids}
    elif current_user["role"] == UserRole.RESELLER.value:
        # Resellers can only see merchants in their portfolio
        query["reseller_id"] = current_user.get("reseller_id")
    elif reseller_id:
        # Super admin can filter by reseller
        query["reseller_id"] = reseller_id
    
    merchants = await db.merchants.find(query, {"_id": 0}).to_list(1000)
    return merchants

@api_router.get("/merchants/{merchant_id}", response_model=Merchant)
async def get_merchant(merchant_id: str, current_user: dict = Depends(get_current_user)):
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Role-based access check
    if current_user["role"] == UserRole.MERCHANT.value:
        merchant_ids = current_user.get("merchant_ids", [])
        if merchant_id not in merchant_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == UserRole.RESELLER.value:
        if merchant.get("reseller_id") != current_user.get("reseller_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    return merchant

@api_router.get("/merchants/slug/{slug}")
async def get_merchant_by_slug(slug: str):
    merchant = await db.merchants.find_one({"slug": slug}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant

@api_router.patch("/merchants/{merchant_id}")
async def update_merchant(
    merchant_id: str,
    updates: dict,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    # Remove protected fields
    updates.pop("id", None)
    updates.pop("created_at", None)
    
    result = await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Log merchant update
    await log_audit(
        action="merchant_updated",
        endpoint=f"/api/merchants/{merchant_id}",
        user=user,
        merchant_id=merchant_id,
        request_data={"updated_fields": list(updates.keys())}
    )
    
    return await db.merchants.find_one({"id": merchant_id}, {"_id": 0})

@api_router.put("/merchants/{merchant_id}", response_model=Merchant)
async def put_merchant(
    merchant_id: str,
    updates: dict,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """Update merchant (PUT for full replacement) - admin/reseller only"""
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Role-based access check for resellers
    if user["role"] == UserRole.RESELLER.value:
        if merchant.get("reseller_id") != user.get("reseller_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Remove protected fields
    updates.pop("id", None)
    updates.pop("created_at", None)
    
    result = await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Log merchant update
    await log_audit(
        action="merchant_updated",
        endpoint=f"/api/merchants/{merchant_id}",
        user=user,
        merchant_id=merchant_id,
        request_data={"updated_fields": list(updates.keys())}
    )
    
    updated_merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    return updated_merchant

@api_router.patch("/merchants/{merchant_id}/branding")
async def update_merchant_branding(
    merchant_id: str,
    branding: BrandingSettings,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    result = await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": {"branding": branding.model_dump()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Log branding update
    await log_audit(
        action="merchant_branding_updated",
        endpoint=f"/api/merchants/{merchant_id}/branding",
        user=user,
        merchant_id=merchant_id,
        request_data={"primary_color": branding.primary_color}
    )
    
    return {"message": "Branding updated successfully"}

@api_router.patch("/merchants/{merchant_id}/hours")
async def update_store_hours(
    merchant_id: str,
    hours: List[StoreHours],
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    result = await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": {"store_hours": [h.model_dump() for h in hours]}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Log store hours update
    await log_audit(
        action="merchant_hours_updated",
        endpoint=f"/api/merchants/{merchant_id}/hours",
        user=user,
        merchant_id=merchant_id,
        request_data={"days_updated": len(hours)}
    )
    
    return {"message": "Store hours updated successfully"}


@api_router.post("/merchants/{merchant_id}/deactivate")
async def deactivate_merchant(
    merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """
    Deactivate (deboard) a merchant. This will:
    - Set is_active to False
    - Clear shepherd_config to unlink from Shepherd
    - Optionally delete associated menu data
    """
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Role-based access check for resellers
    if user["role"] == UserRole.RESELLER.value:
        if merchant.get("reseller_id") != user.get("reseller_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Deactivate the merchant
    await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": {
            "is_active": False,
            "shepherd_config": None,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivated_by": user.get("id")
        }}
    )
    
    # Log the deactivation
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "merchant_id": merchant_id,
        "action": "merchant_deactivated",
        "endpoint": f"/api/merchants/{merchant_id}/deactivate",
        "request_data": {"merchant_name": merchant.get("name")},
        "status_code": 200,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Merchant '{merchant.get('name')}' has been deactivated"}


@api_router.post("/merchants/{merchant_id}/reactivate")
async def reactivate_merchant(
    merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """Reactivate a previously deactivated merchant"""
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Role-based access check for resellers
    if user["role"] == UserRole.RESELLER.value:
        if merchant.get("reseller_id") != user.get("reseller_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": {"is_active": True}, "$unset": {"deactivated_at": "", "deactivated_by": ""}}
    )
    
    # Log the reactivation
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "merchant_id": merchant_id,
        "action": "merchant_reactivated",
        "endpoint": f"/api/merchants/{merchant_id}/reactivate",
        "request_data": {"merchant_name": merchant.get("name")},
        "status_code": 200,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Merchant '{merchant.get('name')}' has been reactivated"}


@api_router.delete("/merchants/{merchant_id}")
async def delete_merchant(
    merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """
    Permanently delete a merchant and all associated data.
    Only Super Admin can perform this action.
    """
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Delete all associated data
    await db.menu_categories.delete_many({"merchant_id": merchant_id})
    await db.menu_items.delete_many({"merchant_id": merchant_id})
    await db.orders.delete_many({"merchant_id": merchant_id})
    await db.merchants.delete_one({"id": merchant_id})
    
    # Update reseller merchant count
    if merchant.get("reseller_id"):
        await db.resellers.update_one(
            {"id": merchant["reseller_id"]},
            {"$inc": {"merchant_count": -1}}
        )
    
    # Log the deletion
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "merchant_id": merchant_id,
        "action": "merchant_deleted",
        "endpoint": f"/api/merchants/{merchant_id}",
        "request_data": {"merchant_name": merchant.get("name"), "permanently_deleted": True},
        "status_code": 200,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Merchant '{merchant.get('name')}' has been permanently deleted"}


# ============== MENU SCHEDULE HELPERS ==============
def is_schedule_active(schedule_days: Optional[str], schedule_start: Optional[str], schedule_end: Optional[str], check_time: datetime = None) -> bool:
    """
    Check if a menu schedule is currently active based on day of week and time.
    
    Args:
        schedule_days: String like "NYYYYYN" where Y=active, position = day (Sun=0, Mon=1, ..., Sat=6)
        schedule_start: Time string like "10:00"
        schedule_end: Time string like "16:00"
        check_time: Time to check against (defaults to now)
    
    Returns:
        True if the schedule is currently active
    """
    if not schedule_days:
        return True  # No schedule = always active
    
    if check_time is None:
        check_time = datetime.now()
    
    # Get current day of week (0=Sunday, 6=Saturday in our format)
    # Python's weekday(): Monday=0, Sunday=6
    # Shepherd format: Sunday=0, Monday=1, ..., Saturday=6
    python_weekday = check_time.weekday()  # Monday=0
    shepherd_day = (python_weekday + 1) % 7  # Convert to Sunday=0 format
    
    # Check if today is an active day
    if len(schedule_days) > shepherd_day:
        if schedule_days[shepherd_day] != 'Y':
            return False
    
    # If no time constraints, just check day
    if not schedule_start or not schedule_end:
        return True
    
    # Special case: 00:00-00:00 means all day
    if schedule_start == "00:00" and schedule_end == "00:00":
        return True
    
    try:
        current_time = check_time.strftime("%H:%M")
        
        # Handle overnight schedules (e.g., 22:00-02:00)
        if schedule_end < schedule_start:
            # Active if current time is after start OR before end
            return current_time >= schedule_start or current_time < schedule_end
        else:
            # Normal schedule: check if between start and end
            return schedule_start <= current_time < schedule_end
    except Exception:
        return True  # If parsing fails, default to active


# ============== MENU ENDPOINTS ==============
@api_router.post("/menu/categories", response_model=MenuCategory)
async def create_category(
    data: MenuCategoryCreate,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    category = MenuCategory(**data.model_dump())
    await db.menu_categories.insert_one(category.model_dump())
    
    # Log category creation
    await log_audit(
        action="menu_category_created",
        endpoint="/api/menu/categories",
        user=user,
        merchant_id=data.merchant_id,
        request_data={"name": data.name}
    )
    
    return category

@api_router.get("/menu/categories/{merchant_id}", response_model=List[MenuCategory])
async def get_categories(
    merchant_id: str,
    filter_by_schedule: bool = Query(default=True, description="Filter categories by current time schedule")
):
    """
    Get menu categories for a merchant.
    By default, filters to only show categories that are currently active based on their schedule.
    Set filter_by_schedule=false to get all categories regardless of time.
    """
    categories = await db.menu_categories.find(
        {"merchant_id": merchant_id, "is_active": True},
        {"_id": 0}
    ).sort("display_order", 1).to_list(100)
    
    if filter_by_schedule:
        # Filter categories based on their schedule
        active_categories = []
        for cat in categories:
            if is_schedule_active(
                cat.get("schedule_days"),
                cat.get("schedule_start"),
                cat.get("schedule_end")
            ):
                active_categories.append(cat)
        return active_categories
    
    return categories

@api_router.post("/menu/items", response_model=MenuItem)
async def create_menu_item(
    data: MenuItemCreate,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    item = MenuItem(**data.model_dump())
    doc = item.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.menu_items.insert_one(doc)
    
    # Log menu item creation
    await log_audit(
        action="menu_item_created",
        endpoint="/api/menu/items",
        user=user,
        merchant_id=data.merchant_id,
        request_data={"name": data.name, "price": data.price}
    )
    
    return item

@api_router.get("/menu/items/{merchant_id}", response_model=List[MenuItem])
async def get_menu_items(
    merchant_id: str,
    category_id: Optional[str] = None
):
    query = {"merchant_id": merchant_id, "is_available": True}
    if category_id:
        query["category_id"] = category_id
    
    items = await db.menu_items.find(query, {"_id": 0}).to_list(500)

    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0, "default_tax_rate_percent": 1, "shepherd_tax_rates": 1})
    merchant_default_tax_rate = normalize_tax_rate_value((merchant or {}).get("default_tax_rate_percent")) or 0.0
    merchant_tax_rate_map = {
        str(row.get("tax_rate_id")): normalize_tax_rate_value(row.get("rate")) or 0.0
        for row in ((merchant or {}).get("shepherd_tax_rates") or [])
        if isinstance(row, dict) and row.get("tax_rate_id")
    }

    for item in items:
        if item.get("tax_rate_percent") is None:
            rate_from_map = merchant_tax_rate_map.get(str(item.get("tax_rate_id"))) if item.get("tax_rate_id") else None
            item["tax_rate_percent"] = rate_from_map if rate_from_map is not None else merchant_default_tax_rate
        item["merchant_default_tax_rate_percent"] = merchant_default_tax_rate

    return items

@api_router.get("/menu/item/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    merchant = await db.merchants.find_one(
        {"id": item.get("merchant_id")},
        {"_id": 0, "default_tax_rate_percent": 1, "shepherd_tax_rates": 1},
    )
    merchant_default_tax_rate = normalize_tax_rate_value((merchant or {}).get("default_tax_rate_percent")) or 0.0
    merchant_tax_rate_map = {
        str(row.get("tax_rate_id")): normalize_tax_rate_value(row.get("rate")) or 0.0
        for row in ((merchant or {}).get("shepherd_tax_rates") or [])
        if isinstance(row, dict) and row.get("tax_rate_id")
    }

    if item.get("tax_rate_percent") is None:
        rate_from_map = merchant_tax_rate_map.get(str(item.get("tax_rate_id"))) if item.get("tax_rate_id") else None
        item["tax_rate_percent"] = rate_from_map if rate_from_map is not None else merchant_default_tax_rate
    item["merchant_default_tax_rate_percent"] = merchant_default_tax_rate

    return item

@api_router.patch("/menu/items/{item_id}")
async def update_menu_item(
    item_id: str,
    updates: dict,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    # Get item first to get merchant_id for logging
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    updates.pop("id", None)
    updates.pop("created_at", None)
    
    await db.menu_items.update_one(
        {"id": item_id},
        {"$set": updates}
    )
    
    # Log menu item update
    await log_audit(
        action="menu_item_updated",
        endpoint=f"/api/menu/items/{item_id}",
        user=user,
        merchant_id=item.get("merchant_id"),
        request_data={"item_name": item.get("name"), "updated_fields": list(updates.keys())}
    )
    
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})

# ============== ORDER ENDPOINTS ==============
async def get_next_order_number(merchant_id: str) -> int:
    result = await db.orders.find_one(
        {"merchant_id": merchant_id},
        sort=[("order_number", -1)]
    )
    return (result.get("order_number", 0) if result else 0) + 1


def extract_shepherd_status(result: Any) -> str:
    """Extract a Shepherd/POS status string from the response payload."""
    if isinstance(result, dict):
        # First check top-level status keys
        for key in (
            "status",
            "Status",
            "ticket_status",
            "ticketStatus",
            "order_status",
            "orderStatus"
        ):
            value = result.get(key)
            if value is not None:
                return str(value).strip()
        
        # Check inside tickets array (Shepherd API response structure)
        tickets = result.get("tickets", [])
        if isinstance(tickets, list) and len(tickets) > 0:
            ticket = tickets[0]  # Get first ticket
            if isinstance(ticket, dict):
                for key in (
                    "status",
                    "Status",
                    "ticket_status",
                    "ticketStatus"
                ):
                    value = ticket.get(key)
                    if value is not None:
                        return str(value).strip()
    
    return str(result or "").strip()


async def get_shepherd_order_status_response(shepherd, shepherd_merchant_id: str, order: dict) -> tuple:
    """Try Shepherd order status lookup using stored Shepherd IDs or refs."""
    candidates = []
    if order.get("shepherd_order_id"):
        candidates.append(order["shepherd_order_id"])
    if order.get("shepherd_order_ref") and order["shepherd_order_ref"] not in candidates:
        candidates.append(order["shepherd_order_ref"])

    last_error = None
    for order_ref in candidates:
        try:
            logger.info(f"Query Shepherd status using order reference: {order_ref}")
            response = await shepherd.get_order_status(shepherd_merchant_id, order_ref)
            return response, order_ref
        except Exception as e:
            logger.warning(f"Shepherd status lookup failed for ref {order_ref}: {e}")
            last_error = e

    if last_error:
        raise last_error
    raise ValueError("No Shepherd order reference available for status lookup")


def map_shepherd_status_to_internal(shepherd_status: str, default_status: str) -> str:
    """Map Shepherd/POS order status values into internal RNOO order status."""
    normalized = (shepherd_status or "").strip().lower()
    status_mapping = {
        "added": OrderStatus.CONFIRMED.value,
        "received": OrderStatus.CONFIRMED.value,
        "confirmed": OrderStatus.CONFIRMED.value,
        "preparing": OrderStatus.PREPARING.value,
        "ready": OrderStatus.READY.value,
        "completed": OrderStatus.DELIVERED.value,
        "delivered": OrderStatus.DELIVERED.value,
        "closed": OrderStatus.DELIVERED.value,
        "cancelled": OrderStatus.CANCELLED.value,
        "voided": OrderStatus.CANCELLED.value,
    }
    return status_mapping.get(normalized, default_status)


async def submit_order_to_shepherd_async(order_id: str, order_dict: dict, merchant: dict):
    """
    Background task to submit order to Shepherd API.
    This runs asynchronously after order creation.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        logger.warning(f"Order {order_id}: Shepherd not configured, skipping injection")
        return
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        logger.warning(f"Order {order_id}: Merchant has no Shepherd config, skipping injection")
        return

    reset_shepherd_http_history()
    
    shepherd_order = None

    try:
        # Build Shepherd order format
        shepherd_order = build_shepherd_order(order_dict, shepherd_config)
        request_payload = build_order_integration_log_payload(
            order_dict,
            merchant,
            shepherd_merchant_id=shepherd_merchant_id,
            shepherd_order=shepherd_order
        )
        
        # Generate order reference to match the payload sent to Shepherd
        merchant_id = str(shepherd_merchant_id or order_dict.get("merchant_id", ""))
        merchant_id_digits = "".join(ch for ch in merchant_id if ch.isdigit())
        merchant_id_suffix = merchant_id_digits[:5] or merchant_id[:5]
        order_date = datetime.now(timezone.utc).strftime("%d-%m-%y")
        order_ref = f"R-{order_dict.get('order_number', 0)}-{merchant_id_suffix}-{order_date}"

        ticket_items = []
        if isinstance(shepherd_order, dict):
            tickets = shepherd_order.get("tickets") or []
            if tickets and isinstance(tickets[0], dict):
                ticket_items = tickets[0].get("items") or []

        tax_tip_items = []
        for ticket_item in ticket_items:
            if not isinstance(ticket_item, dict):
                continue
            pn_value = str(ticket_item.get("pn") or "").strip().upper()
            n_value = str(ticket_item.get("n") or "").strip().upper()
            if pn_value in {"TAX", "TIP"} or n_value in {"TAX", "TIP"}:
                tax_tip_items.append(ticket_item)

        await log_audit(
            action="order_shepherd_tax_tip_payload",
            endpoint="background_task",
            merchant_id=order_dict["merchant_id"],
            request_data={
                "order_id": order_id,
                "order_number": order_dict.get("order_number"),
                "shepherd_merchant_id": shepherd_merchant_id,
                "shepherd_order_ref": order_ref,
                "subtotal": order_dict.get("subtotal"),
                "tax": order_dict.get("tax"),
                "tip": order_dict.get("tip"),
                "total": order_dict.get("total"),
                "tax_tip_items": tax_tip_items,
            },
            status_code=200,
        )
        
        logger.info(f"Order {order_id}: Submitting to Shepherd merchant {shepherd_merchant_id} with ref {order_ref}")
        
        # Submit to Shepherd
        result = await shepherd.submit_order(shepherd_merchant_id, shepherd_order)
        
        # Extract Shepherd order ID from response
        # Response format: {"status": "Added", "id": "PX,ol2GwWu1wcQ5PtXogq5XNQ,qwe765"}
        shepherd_order_id = result.get("id") if isinstance(result, dict) else None
        shepherd_status = result.get("status") if isinstance(result, dict) else None
        
        # Update order with Shepherd response
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "shepherd_submitted": True,
                "shepherd_response": result,
                "shepherd_submitted_at": datetime.now(timezone.utc).isoformat(),
                "shepherd_order_ref": order_ref,
                "shepherd_order_id": shepherd_order_id,
                "shepherd_status": shepherd_status,
                "shepherd_status_updated_at": datetime.now(timezone.utc).isoformat(),
                "status": OrderStatus.CONFIRMED.value
            }}
        )
        
        # Broadcast status update via WebSocket
        updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if updated_order:
            await ws_manager.broadcast_order_event(
                "order_confirmed",
                updated_order,
                order_dict["merchant_id"]
            )
        
        logger.info(f"Order {order_id}: Successfully submitted to Shepherd (ID: {shepherd_order_id})")
        
        # Log the submission
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": order_dict["merchant_id"],
            "action": "order_submitted_to_shepherd",
            "endpoint": "background_task",
            "request_data": request_payload,
            "response_data": {
                "shepherd_response": result,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        await log_audit(
            action="order_shepherd_submission_succeeded",
            endpoint="background_task",
            merchant_id=order_dict["merchant_id"],
            request_data={
                "order_id": order_id,
                "order_number": order_dict.get("order_number"),
                "shepherd_merchant_id": shepherd_merchant_id,
                "shepherd_order_ref": order_ref,
            },
            response_data={
                "shepherd_order_id": shepherd_order_id,
                "shepherd_status": shepherd_status,
            },
            status_code=200,
        )
        
    except Exception as e:
        logger.error(f"Order {order_id}: Failed to submit to Shepherd: {e}")
        
        # Update order with error
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "shepherd_submitted": False,
                "shepherd_error": str(e),
                "shepherd_attempted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log the failure
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": order_dict["merchant_id"],
            "action": "order_shepherd_submission_failed",
            "endpoint": "background_task",
            "request_data": build_order_integration_log_payload(
                order_dict,
                merchant,
                shepherd_merchant_id=shepherd_merchant_id,
                shepherd_order=shepherd_order
            ),
            "response_data": {
                "error": str(e),
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })


@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderCreate, background_tasks: BackgroundTasks):
    merchant = await db.merchants.find_one({"id": data.merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    merchant_tax_rate_map = {
        str(row.get("tax_rate_id")): normalize_tax_rate_value(row.get("rate")) or 0.0
        for row in (merchant.get("shepherd_tax_rates") or [])
        if isinstance(row, dict) and row.get("tax_rate_id")
    }

    merchant_default_tax_rate = normalize_tax_rate_value(
        merchant.get("default_tax_rate_percent")
    )
    if merchant_default_tax_rate is None:
        merchant_default_tax_rate = 0.0

    # Enrich cart payload from synced menu data so pn/plu can be sent to Shepherd
    menu_item_ids = list({item.menu_item_id for item in data.items if item.menu_item_id})
    menu_items_lookup = {}
    if menu_item_ids:
        menu_docs = await db.menu_items.find(
            {"id": {"$in": menu_item_ids}, "merchant_id": data.merchant_id},
            {
                "_id": 0,
                "id": 1,
                "plu": 1,
                "pos_id": 1,
                "modifier_groups": 1,
                "tax_rate_id": 1,
                "tax_rate_percent": 1,
            }
        ).to_list(1000)
        menu_items_lookup = {doc.get("id"): doc for doc in menu_docs}

    for item in data.items:
        menu_doc = menu_items_lookup.get(item.menu_item_id, {})

        if not item.plu:
            item.plu = menu_doc.get("plu") or ""

        if not item.shepherd_pos_id:
            item.shepherd_pos_id = menu_doc.get("pos_id") or ""

        if not item.tax_rate_id:
            item.tax_rate_id = menu_doc.get("tax_rate_id")

        if item.tax_rate_percent is None:
            item.tax_rate_percent = menu_doc.get("tax_rate_percent")

        if item.tax_rate_percent is None and item.tax_rate_id:
            item.tax_rate_percent = merchant_tax_rate_map.get(str(item.tax_rate_id))

        option_lookup = {}
        for group in menu_doc.get("modifier_groups", []):
            for option in group.get("options", []):
                option_id = option.get("id")
                if option_id:
                    option_lookup[option_id] = option

        for mod in item.modifiers:
            option = option_lookup.get(mod.option_id, {})

            if not mod.plu:
                mod.plu = option.get("plu") or ""

            if not mod.shepherd_pos_id:
                mod.shepherd_pos_id = option.get("shepherd_pos_id") or option.get("pos_id") or ""

    # Calculate totals with cent-accurate decimal rounding
    def money(value: float) -> Decimal:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    subtotal_dec = Decimal("0.00")
    tax_dec = Decimal("0.00")
    tax_line_diagnostics = []
    for item in data.items:
        unit_price_dec = Decimal(str(item.unit_price))
        modifier_total_dec = sum((Decimal(str(m.price)) for m in item.modifiers), Decimal("0.00"))
        line_total_dec = (unit_price_dec + modifier_total_dec) * Decimal(item.quantity)
        subtotal_dec += line_total_dec

        line_rate_source = "item_tax_rate_percent"
        line_rate = normalize_tax_rate_value(item.tax_rate_percent)
        if line_rate is None and item.tax_rate_id:
            mapped_rate = merchant_tax_rate_map.get(str(item.tax_rate_id))
            if mapped_rate is not None:
                line_rate = mapped_rate
                line_rate_source = "tax_rate_id_map"

        if line_rate is None:
            line_rate = merchant_default_tax_rate
            line_rate_source = "merchant_default" if merchant_default_tax_rate > 0 else "zero_fallback"

        line_rate_dec = Decimal(str(line_rate))
        line_tax_dec = (line_total_dec * line_rate_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tax_dec += line_tax_dec

        tax_line_diagnostics.append({
            "menu_item_id": item.menu_item_id,
            "name": item.name,
            "quantity": item.quantity,
            "tax_rate_id": item.tax_rate_id,
            "tax_rate_percent": line_rate,
            "tax_rate_source": line_rate_source,
            "line_subtotal": float(line_total_dec),
            "line_tax": float(line_tax_dec),
        })

    subtotal_dec = money(float(subtotal_dec))
    tax_dec = money(float(tax_dec))
    tip_dec = money(data.payment.tip)
    total_dec = subtotal_dec + tax_dec + tip_dec
    
    order_number = await get_next_order_number(data.merchant_id)
    
    # Calculate need_datetime for Shepherd based on order timing
    need_datetime = None
    if data.order_timing == OrderTimingType.ASAP:
        # ASAP - no specific time needed
        need_datetime = None
    elif data.order_timing in [OrderTimingType.ADVANCE, OrderTimingType.FUTURE]:
        # Advance or Future order - combine date and time
        if data.scheduled_date and data.scheduled_time:
            try:
                # Parse date and time, create RFC3339 timestamp
                dt_str = f"{data.scheduled_date}T{data.scheduled_time}:00"
                need_datetime = datetime.fromisoformat(dt_str).replace(tzinfo=timezone.utc).isoformat()
            except ValueError:
                logger.warning(f"Invalid scheduled date/time: {data.scheduled_date} {data.scheduled_time}")
    
    order = Order(
        merchant_id=data.merchant_id,
        order_number=order_number,
        customer=data.customer,
        delivery_type=data.delivery_type,
        items=data.items,
        subtotal=float(subtotal_dec),
        tax=float(tax_dec),
        tip=float(tip_dec),
        total=float(total_dec),
        payment=data.payment,
        order_timing=data.order_timing,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        need_datetime=need_datetime,
        notes=data.notes,
        status=OrderStatus.PENDING
    )
    
    # Mock payment processing: pay-at-store stays open until settled in store
    if str(order.payment.method).lower() == "pay_at_store":
        order.payment.status = PaymentStatus.PENDING
    else:
        order.payment.status = PaymentStatus.COMPLETED
    order.payment.amount = order.total
    
    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    # Add Shepherd tracking fields
    doc["shepherd_submitted"] = False
    doc["shepherd_response"] = None
    doc["shepherd_error"] = None
    doc["shepherd_order_ref"] = None
    doc["shepherd_order_id"] = None
    doc["shepherd_status"] = None
    
    await db.orders.insert_one(doc)
    
    # Log the order creation
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": "order_created",
        "merchant_id": data.merchant_id,
        "endpoint": "/api/orders",
        "request_data": {
            "order_id": order.id,
            "subtotal": order.subtotal,
            "tax": order.tax,
            "tip": order.tip,
            "total": order.total,
            "merchant_default_tax_rate_percent": merchant_default_tax_rate,
            "tax_line_diagnostics": tax_line_diagnostics,
        },
        "status_code": 201,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Broadcast new order via WebSocket
    await ws_manager.broadcast_order_event("new_order", doc, data.merchant_id)
    
    # Submit order to Shepherd in background (if configured)
    if merchant and merchant.get("shepherd_config", {}).get("merchant_id"):
        background_tasks.add_task(submit_order_to_shepherd_async, order.id, doc, merchant)
        logger.info(f"Order {order.id}: Queued for Shepherd submission")
    
    return order

@api_router.get("/orders")
async def list_orders(
    merchant_id: Optional[str] = None,
    order_status: Optional[OrderStatus] = None,
    limit: int = Query(default=50, le=200),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    query = {}

    # Role-based filtering
    if current_user["role"] == UserRole.MERCHANT.value:
        # Merchants can only see orders for their merchants
        merchant_ids = current_user.get("merchant_ids", [])
        if not merchant_ids:
            return {"orders": [], "pagination": {"total": 0, "limit": limit, "skip": skip, "has_more": False}}
        query["merchant_id"] = {"$in": merchant_ids}
    elif current_user["role"] == UserRole.RESELLER.value:
        # Resellers can only see orders for merchants in their portfolio
        reseller_merchants = await db.merchants.find(
            {"reseller_id": current_user.get("reseller_id")},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        merchant_ids = [m["id"] for m in reseller_merchants]
        if not merchant_ids:
            return {"orders": [], "pagination": {"total": 0, "limit": limit, "skip": skip, "has_more": False}}
        query["merchant_id"] = {"$in": merchant_ids}
    elif merchant_id:
        # Super admin can filter by specific merchant
        query["merchant_id"] = merchant_id

    if order_status:
        query["status"] = order_status.value

    # Get total count for pagination
    total_count = await db.orders.count_documents(query)

    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Add pagination metadata to response
    response_data = {
        "orders": orders,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "skip": skip,
            "has_more": skip + len(orders) < total_count
        }
    }

    return response_data


@api_router.get("/orders/sync-status-info")
async def get_order_sync_info(
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """
    Get information about the automatic order status sync background task.
    Returns sync configuration and count of orders pending sync.
    """
    # Count orders that will be synced
    query = {
        "shepherd_submitted": True,
        "shepherd_order_id": {"$ne": None, "$exists": True},
        "status": {"$nin": [OrderStatus.DELIVERED.value, OrderStatus.CANCELLED.value]}
    }
    pending_sync_count = await db.orders.count_documents(query)
    
    return {
        "sync_enabled": get_shepherd_client() is not None,
        "sync_interval_seconds": ORDER_STATUS_SYNC_INTERVAL_SECONDS,
        "orders_pending_sync": pending_sync_count,
        "background_task_running": _background_sync_task is not None and not _background_sync_task.done()
    }


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.get("/orders/public/{order_id}", response_model=Order)
async def get_order_public(order_id: str):
    """
    Public endpoint for order tracking - no authentication required.
    Allows customers to track their orders using the order ID.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    new_status: OrderStatus,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    # Get order first to access merchant_id
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.get("status")
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": new_status.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log status change
    await log_audit(
        action="order_status_updated",
        endpoint=f"/api/orders/{order_id}/status",
        user=current_user,
        merchant_id=order["merchant_id"],
        request_data={
            "order_number": order.get("order_number"),
            "old_status": old_status,
            "new_status": new_status.value
        }
    )
    
    # Get updated order and broadcast via WebSocket
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if updated_order:
        await ws_manager.broadcast_order_event(
            f"order_status_{new_status.value}",
            updated_order,
            order["merchant_id"]
        )
    
    return {"message": f"Order status updated to {new_status.value}"}

@api_router.get("/orders/{order_id}/poscnx")
async def get_order_poscnx_xml(
    order_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    order_doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")
    
    merchant = await db.merchants.find_one({"id": order_doc["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Convert dict to Order model
    order = Order(**order_doc)
    xml_content = build_poscnx_order_xml(order, merchant)
    
    return {"xml": xml_content}


@api_router.post("/orders/{order_id}/submit-to-shepherd")
async def manual_submit_order_to_shepherd(
    order_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Manually submit or retry submitting an order to Shepherd.
    Use this if automatic submission failed or needs to be retried.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get the order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get merchant shepherd config
    merchant = await db.merchants.find_one({"id": order["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        raise HTTPException(status_code=400, detail="Merchant does not have Shepherd configuration")

    shepherd_order = None
    reset_shepherd_http_history()

    try:
        # Build Shepherd order format
        shepherd_order = build_shepherd_order(order, shepherd_config)
        request_payload = build_order_integration_log_payload(
            order,
            merchant,
            shepherd_merchant_id=shepherd_merchant_id,
            shepherd_order=shepherd_order
        )
        
        logger.info(f"Manual submission: Order {order_id} to Shepherd merchant {shepherd_merchant_id}")
        
        # Submit to Shepherd
        result = await shepherd.submit_order(shepherd_merchant_id, shepherd_order)
        
        # Update order with Shepherd response
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "shepherd_submitted": True,
                "shepherd_response": result,
                "shepherd_submitted_at": datetime.now(timezone.utc).isoformat(),
                "shepherd_error": None,
                "status": OrderStatus.CONFIRMED.value
            }}
        )
        
        # Broadcast status update via WebSocket
        updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if updated_order:
            await ws_manager.broadcast_order_event(
                "order_confirmed",
                updated_order,
                order["merchant_id"]
            )
        
        # Log the submission
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_manual_submit_to_shepherd",
            "endpoint": f"/api/orders/{order_id}/submit-to-shepherd",
            "request_data": request_payload,
            "response_data": {
                "shepherd_response": result,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Order submitted to Shepherd successfully",
            "order_id": order_id,
            "shepherd_response": result
        }
        
    except Exception as e:
        logger.error(f"Manual submission failed for order {order_id}: {e}")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_manual_submit_to_shepherd_failed",
            "endpoint": f"/api/orders/{order_id}/submit-to-shepherd",
            "request_data": build_order_integration_log_payload(
                order,
                merchant,
                shepherd_merchant_id=shepherd_merchant_id,
                shepherd_order=shepherd_order
            ),
            "response_data": {
                "error": str(e),
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Update order with error
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "shepherd_submitted": False,
                "shepherd_error": str(e),
                "shepherd_attempted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        raise HTTPException(status_code=500, detail=f"Order submission failed: {str(e)}")


@api_router.get("/merchants/{merchant_id}/shepherd-details")
async def get_merchant_shepherd_details(
    merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Get comprehensive merchant details from Shepherd API.
    Includes merchant info, HQDing site data, menu data, tax rates, schedules, and logo.
    Read-only display of all available Shepherd data.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get local merchant
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    # Role-based access check
    if user["role"] == UserRole.MERCHANT.value:
        merchant_ids = user.get("merchant_ids", [])
        if merchant_id not in merchant_ids:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user["role"] == UserRole.RESELLER.value:
        if merchant.get("reseller_id") != user.get("reseller_id"):
            raise HTTPException(status_code=403, detail="Access denied")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        response = {
            "merchant_id": merchant_id,
            "shepherd_linked": False,
            "message": "Merchant is not linked to Shepherd"
        }
        await log_audit(
            action="shepherd_details_fetch_skipped_unlinked",
            endpoint=f"/api/merchants/{merchant_id}/shepherd-details",
            user=user,
            merchant_id=merchant_id,
            request_data={"shepherd_linked": False},
            response_data={"message": "Merchant is not linked to Shepherd"},
            status_code=200,
        )
        return response
    
    result = {
        "merchant_id": merchant_id,
        "shepherd_merchant_id": shepherd_merchant_id,
        "shepherd_linked": True,
        "local_merchant": merchant,
        "logo_url": ShepherdAPIClient.get_logo_url(shepherd_merchant_id),
        "shepherd_data": {}
    }
    
    try:
        # Fetch merchant info
        merchant_info = await shepherd.get_merchant(shepherd_merchant_id)
        result["shepherd_data"]["merchant_info"] = merchant_info
    except Exception as e:
        result["shepherd_data"]["merchant_info"] = {"error": str(e)}
    
    try:
        # Fetch HQDing site information - comprehensive license and site data
        hqding_info = await shepherd.get_hqding_info(shepherd_merchant_id)
        result["shepherd_data"]["hqding"] = hqding_info
        
        # Extract key site info for easy access
        if hqding_info and "exchange" in hqding_info:
            exchange = hqding_info["exchange"]
            site = exchange.get("site", {})
            licenses = exchange.get("licenses", [])
            stamp = exchange.get("stamp", {})
            stations = exchange.get("stations", [])
            
            result["site_summary"] = {
                "name": site.get("locname"),
                "phone": site.get("locphone"),
                "file_server": site.get("filesvr"),
                "rpower_version": site.get("version10"),
                "app_version": site.get("appver"),
                "database_version": site.get("dbver"),
                "windows_version": site.get("winver"),
                "lan_ip": site.get("interip"),
                "serial_number": stamp.get("serno"),
                "dealer_number": stamp.get("dlrno"),
                "licensed_users": stamp.get("users"),
                "workstation_count": len(stations),
                "locations": []
            }
            
            # Add location info from licenses array
            for loc in licenses:
                location = {
                    "number": loc.get("num"),
                    "name": loc.get("n1"),
                    "address_line1": loc.get("l1"),
                    "address_line2": loc.get("l2"),
                    "address_line3": loc.get("l3"),
                    "city": loc.get("c"),
                    "state": loc.get("s"),
                    "zip": loc.get("z"),
                    "phone": loc.get("ph")
                }
                result["site_summary"]["locations"].append(location)
            
            # Add workstation info
            result["site_summary"]["workstations"] = [
                {
                    "name": ws.get("name"),
                    "computer_name": ws.get("compname"),
                    "ip": ws.get("localip"),
                    "status": ws.get("flags")
                }
                for ws in stations
            ]
            
        # Get last HQDing timestamp
        if hqding_info and "xyzzyHeader" in hqding_info:
            header = hqding_info["xyzzyHeader"]
            result["site_summary"]["last_hqding"] = {
                "timestamp": header.get("date_time"),
                "timezone": header.get("tz"),
                "rpower_version": header.get("app_version")
            }
            
    except Exception as e:
        logger.error(f"Failed to fetch HQDing info: {e}")
        result["shepherd_data"]["hqding"] = {"error": str(e)}
    
    core_client = None

    # Try to get additional store info from RPOWER Core API using CG (Customer Group)
    # CG = Customer Group (manually configured in shepherd_config.rpower_cg)
    try:
        rpower_cg = shepherd_config.get("rpower_cg")  # Get CG from merchant config
        
        if rpower_cg:
            core_client = get_rpower_core_client()
            if core_client and core_client.token:
                logger.info(f"Fetching RPOWER Core API store info using GetStoreByCg for CG={rpower_cg}")
                store_info = await core_client.get_store_by_cg(rpower_cg)
                if store_info and "error" not in store_info:
                    result["shepherd_data"]["rpower_store_info"] = store_info
                    # Extract useful address/store info if available
                    # GetStoreByCg returns a list of stores
                    stores = store_info if isinstance(store_info, list) else store_info.get("stores", [])
                    if stores and len(stores) > 0:
                        # Use first store or try to match by serial number / site_code
                        matched_store = None
                        
                        for store in stores:
                            store_site_code = str(store.get("site_code") or "")
                            if shepherd_merchant_id and store_site_code == shepherd_merchant_id:
                                matched_store = store
                                break
                        
                        # Fall back to first store if no match
                        if not matched_store:
                            matched_store = stores[0]
                        
                        if matched_store:
                            if "site_summary" not in result:
                                result["site_summary"] = {}
                            
                            # Extract address from guest_checks array (primary address source)
                            guest_checks = matched_store.get("guest_checks", [])
                            if guest_checks and len(guest_checks) > 0:
                                gc = guest_checks[0]
                                result["site_summary"]["store_address"] = {
                                    "line1": gc.get("address") or gc.get("Address"),
                                    "line2": gc.get("address2") or gc.get("Address2"),
                                    "city": gc.get("city") or gc.get("City"),
                                    "state": gc.get("state") or gc.get("State"),
                                    "zip": gc.get("zip") or gc.get("Zip"),
                                    "phone": gc.get("phone") or gc.get("Phone"),
                                    "url": gc.get("url") or gc.get("Url")
                                }
                            
                            # Store name/phone from Core API
                            store_name = matched_store.get("name") or matched_store.get("Name")
                            store_tag = matched_store.get("tag_name")
                            store_id = matched_store.get("store_id")
                            if store_name:
                                result["site_summary"]["rpower_name"] = store_name
                            if store_tag:
                                result["site_summary"]["rpower_tag"] = store_tag
                            if store_id:
                                result["site_summary"]["rpower_store_id"] = store_id
                            
                            # Additional useful fields
                            result["site_summary"]["rpower_serial"] = matched_store.get("serial_number")
                            result["site_summary"]["rpower_site_code"] = matched_store.get("site_code")
                            result["site_summary"]["rpower_timezone"] = matched_store.get("timezone")
                            result["site_summary"]["rpower_open_days"] = matched_store.get("open_days")
                            result["site_summary"]["rpower_version"] = matched_store.get("version")
                            result["site_summary"]["rpower_stores_count"] = len(stores)
                            result["site_summary"]["rpower_last_update"] = matched_store.get("lup_dttm")
                else:
                    logger.info(f"RPOWER Core API (GetStoreByCg): {store_info.get('error', 'No data')}")
        else:
            logger.info("RPOWER Core API: CG not configured for this merchant")
    except Exception as e:
        logger.warning(f"Failed to fetch RPOWER Core API store info: {e}")
        # Non-critical, don't fail the whole request

    try:
        # Fetch menu data
        menu_data = await shepherd.get_menu(shepherd_merchant_id)
        # Count items and sections
        menus = menu_data.get("Menus", [])
        menu_summary = []
        for menu in menus:
            menu_id = menu.get("MenuId", menu.get("PosId", "Unknown"))
            menu_name = menu.get("Name", "")
            menu_schedule_id = menu.get("ScheduleId")
            menu_tax_rate_id = menu.get("TaxRateId")
            sections = menu.get("Sections", [])
            item_count = sum(len(s.get("Items", [])) for s in sections)
            menu_summary.append({
                "menu_id": menu_id,
                "menu_name": menu_name,
                "schedule_id": menu_schedule_id,
                "tax_rate_id": menu_tax_rate_id,
                "section_count": len(sections),
                "item_count": item_count,
                "is_rnoo": "RNOO" in menu_id.upper()
            })
        result["shepherd_data"]["menu_summary"] = menu_summary
        result["shepherd_data"]["menu_data"] = menu_data
    except Exception as e:
        result["shepherd_data"]["menu_data"] = {"error": str(e)}
    
    try:
        # Fetch tax rates from Shepherd
        tax_rates = await shepherd.get_tax_rates(shepherd_merchant_id)
        result["shepherd_data"]["tax_rates"] = tax_rates
    except Exception as e:
        result["shepherd_data"]["tax_rates"] = {"error": str(e)}
    
    try:
        # Fetch schedules
        schedules = await shepherd.get_schedules(shepherd_merchant_id)
        result["shepherd_data"]["schedules"] = schedules
    except Exception as e:
        result["shepherd_data"]["schedules"] = {"error": str(e)}

    await log_audit(
        action="shepherd_details_fetched",
        endpoint=f"/api/merchants/{merchant_id}/shepherd-details",
        user=user,
        merchant_id=merchant_id,
        request_data={
            "shepherd_merchant_id": shepherd_merchant_id,
            "rpower_cg": shepherd_config.get("rpower_cg"),
        },
        response_data={
            "shepherd_linked": True,
            "has_hqding": "hqding" in result.get("shepherd_data", {}),
            "menu_count": len(result.get("shepherd_data", {}).get("menu_summary", [])),
            "tax_rates_error": result.get("shepherd_data", {}).get("tax_rates", {}).get("error") if isinstance(result.get("shepherd_data", {}).get("tax_rates"), dict) else None,
        },
        status_code=200,
    )
    
    return result


@api_router.post("/orders/{order_id}/sync-status")
async def sync_order_status_from_shepherd(
    order_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Sync order status from Shepherd/POS.
    Fetches the current status from Shepherd and updates the local order.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get the order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order was submitted to Shepherd
    if not order.get("shepherd_submitted") or not order.get("shepherd_order_id"):
        raise HTTPException(status_code=400, detail="Order has not been submitted to Shepherd yet")
    
    # Get merchant shepherd config
    merchant = await db.merchants.find_one({"id": order["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        raise HTTPException(status_code=400, detail="Merchant does not have Shepherd configuration")

    reset_shepherd_http_history()
    
    try:
        # Fetch order status from Shepherd using configured IDs/refs
        result, used_shepherd_ref = await get_shepherd_order_status_response(shepherd, shepherd_merchant_id, order)
        
        shepherd_status_raw = extract_shepherd_status(result)
        shepherd_status = shepherd_status_raw.lower()
        
        new_status = map_shepherd_status_to_internal(shepherd_status, order.get("status"))
        old_status = order.get("status")
        
        # Update order with Shepherd status
        update_data = {
            "shepherd_status": result.get("status") if isinstance(result, dict) else str(result),
            "shepherd_status_updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Only update internal status if it changed
        if new_status != old_status:
            update_data["status"] = new_status
        
        await db.orders.update_one(
            {"id": order_id},
            {"$set": update_data}
        )
        
        # Broadcast status update via WebSocket
        updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if updated_order and new_status != old_status:
            await ws_manager.broadcast_order_event(
                f"order_status_{new_status}",
                updated_order,
                order["merchant_id"]
            )
        
        # Log the sync
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_status_synced_from_shepherd",
            "endpoint": f"/api/orders/{order_id}/sync-status",
            "request_data": build_order_integration_log_payload(
                order,
                merchant,
                shepherd_merchant_id=shepherd_merchant_id,
                used_shepherd_ref=used_shepherd_ref
            ),
            "response_data": {
                "shepherd_status": shepherd_status,
                "new_status": new_status,
                "shepherd_response": result,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Order status synced from Shepherd",
            "order_id": order_id,
            "shepherd_status": result.get("status") if isinstance(result, dict) else str(result),
            "internal_status": new_status,
            "status_changed": new_status != old_status,
            "shepherd_response": result
        }
        
    except Exception as e:
        logger.error(f"Failed to sync order status from Shepherd: {e}")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_status_sync_from_shepherd_failed",
            "endpoint": f"/api/orders/{order_id}/sync-status",
            "request_data": build_order_integration_log_payload(
                order,
                merchant,
                shepherd_merchant_id=shepherd_merchant_id,
            ),
            "response_data": {
                "error": str(e),
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        raise HTTPException(status_code=500, detail=f"Status sync failed: {str(e)}")


@api_router.post("/orders/sync-all-statuses")
async def sync_all_order_statuses_from_shepherd(
    merchant_id: Optional[str] = None,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Sync status for all pending orders from Shepherd/POS.
    Useful for batch refreshing order statuses.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Build query for orders that were submitted to Shepherd but not delivered/cancelled
    query = {
        "shepherd_submitted": True,
        "shepherd_order_id": {"$ne": None},
        "status": {"$nin": [OrderStatus.DELIVERED.value, OrderStatus.CANCELLED.value]}
    }
    
    if merchant_id:
        query["merchant_id"] = merchant_id
    elif user.get("role") == UserRole.MERCHANT.value:
        query["merchant_id"] = user.get("merchant_id")
    
    # Find orders to sync
    orders = await db.orders.find(query, {"_id": 0}).to_list(100)
    
    synced_count = 0
    failed_count = 0
    results = []
    
    for order in orders:
        try:
            merchant = await db.merchants.find_one({"id": order["merchant_id"]}, {"_id": 0})
            if not merchant:
                continue
                
            shepherd_config = merchant.get("shepherd_config", {})
            shepherd_merchant_id = shepherd_config.get("merchant_id")
            
            if not shepherd_merchant_id:
                continue
            
            result, used_shepherd_ref = await get_shepherd_order_status_response(shepherd, shepherd_merchant_id, order)
            
            shepherd_status_raw = extract_shepherd_status(result)
            shepherd_status = shepherd_status_raw.lower()
            
            new_status = map_shepherd_status_to_internal(shepherd_status, order.get("status"))
            old_status = order.get("status")
            
            update_data = {
                "shepherd_status": result.get("status") if isinstance(result, dict) else str(result),
                "shepherd_status_updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if new_status != old_status:
                update_data["status"] = new_status
            
            await db.orders.update_one({"id": order["id"]}, {"$set": update_data})
            
            # Broadcast if status changed
            if new_status != old_status:
                updated_order = await db.orders.find_one({"id": order["id"]}, {"_id": 0})
                if updated_order:
                    await ws_manager.broadcast_order_event(
                        f"order_status_{new_status}",
                        updated_order,
                        order["merchant_id"]
                    )
            
            synced_count += 1
            results.append({
                "order_id": order["id"],
                "order_number": order.get("order_number"),
                "old_status": old_status,
                "new_status": new_status,
                "shepherd_status": shepherd_status
            })
            
        except Exception as e:
            logger.error(f"Failed to sync order {order.get('id')}: {e}")
            failed_count += 1
    
    return {
        "message": f"Synced {synced_count} orders, {failed_count} failed",
        "synced_count": synced_count,
        "failed_count": failed_count,
        "results": results
    }


@api_router.post("/upsell/suggestions/{merchant_id}")
async def get_upsell_suggestions(
    merchant_id: str,
    data: UpsellSuggestionRequest,
):
    merchant = await db.merchants.find_one(
        {"id": merchant_id, "is_active": True},
        {"_id": 0, "id": 1},
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    all_items = await db.menu_items.find(
        {"merchant_id": merchant_id, "is_available": True},
        {"_id": 0},
    ).to_list(1000)
    if not all_items:
        return []

    categories = await db.menu_categories.find(
        {"merchant_id": merchant_id, "is_active": True},
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(500)
    category_name_by_id = {str(c.get("id")): c.get("name") for c in categories if c.get("id")}

    cart_item_ids = {str(item_id) for item_id in (data.cart_item_ids or []) if item_id}
    cart_items = [item for item in all_items if str(item.get("id")) in cart_item_ids]
    cart_categories = {str(item.get("category_id")) for item in cart_items if item.get("category_id")}

    candidates = [item for item in all_items if str(item.get("id")) not in cart_item_ids]
    if cart_categories:
        preferred = [
            item
            for item in candidates
            if str(item.get("category_id") or "") not in cart_categories
        ]
        if preferred:
            candidates = preferred

    if not candidates:
        return []

    since = datetime.now(timezone.utc) - timedelta(days=30)
    recent_orders = await db.orders.find(
        {
            "merchant_id": merchant_id,
            "created_at": {"$gte": since.isoformat()},
        },
        {"_id": 0, "items": 1},
    ).to_list(500)

    item_popularity: Counter = Counter()
    for order in recent_orders:
        for order_item in order.get("items", []):
            item_id = str(order_item.get("menu_item_id") or "")
            if not item_id:
                continue
            item_popularity[item_id] += int(order_item.get("quantity") or 1)

    customer_ordered_ids = set()
    customer_email = (data.customer_email or "").strip().lower()
    if customer_email:
        customer_orders = await db.orders.find(
            {
                "merchant_id": merchant_id,
                "customer.email": customer_email,
            },
            {"_id": 0, "items": 1},
        ).to_list(150)
        for order in customer_orders:
            for order_item in order.get("items", []):
                item_id = order_item.get("menu_item_id")
                if item_id:
                    customer_ordered_ids.add(str(item_id))

    avg_cart_price = 0.0
    if cart_items:
        avg_cart_price = sum(float(item.get("price") or 0) for item in cart_items) / len(cart_items)

    scored = []
    for item in candidates:
        item_id = str(item.get("id") or "")
        if not item_id:
            continue

        popularity = float(item_popularity.get(item_id, 0))
        category_id = str(item.get("category_id") or "")
        price = float(item.get("price") or 0)

        score = popularity
        reason = "Popular with this location"

        if cart_categories and category_id and category_id not in cart_categories:
            score += 3.0
            reason = "Great add-on from another category"

        if customer_email and item_id not in customer_ordered_ids:
            score += 1.5

        if avg_cart_price > 0 and price > 0 and price <= avg_cart_price * 0.75:
            score += 0.5

        scored.append(
            {
                **item,
                "category_name": category_name_by_id.get(category_id),
                "recommendation_score": round(score, 2),
                "reason": reason,
            }
        )

    scored.sort(key=lambda row: row.get("recommendation_score", 0), reverse=True)
    limit = max(1, min(int(data.limit or 4), 8))
    return scored[:limit]


@api_router.post("/upsell/events")
async def track_upsell_event(data: UpsellEventCreate):
    allowed_event_types = {"impression", "click", "add"}
    event_type = (data.event_type or "").strip().lower()
    if event_type not in allowed_event_types:
        raise HTTPException(status_code=400, detail="Invalid upsell event type")

    merchant = await db.merchants.find_one(
        {"id": data.merchant_id, "is_active": True},
        {"_id": 0, "id": 1},
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["event_type"] = event_type
    doc["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.upsell_events.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@api_router.get("/dashboard/upsell-kpis")
async def get_dashboard_upsell_kpis(
    merchant_id: Optional[str] = None,
    merchant_ids: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    allowed_merchant_ids: Optional[List[str]] = None

    if current_user["role"] == UserRole.MERCHANT.value:
        merchant_scope = current_user.get("merchant_ids") or []
        if not merchant_scope and current_user.get("merchant_id"):
            merchant_scope = [current_user.get("merchant_id")]
        allowed_merchant_ids = [str(mid) for mid in merchant_scope if mid]
        if not allowed_merchant_ids:
            return {
                "summary": {
                    "impressions": 0,
                    "clicks": 0,
                    "adds": 0,
                    "ctr": 0,
                    "add_rate": 0,
                    "unique_customers": 0,
                },
                "by_location": [],
                "by_customer": [],
            }
    elif current_user["role"] == UserRole.RESELLER.value:
        reseller_merchants = await db.merchants.find(
            {"reseller_id": current_user.get("reseller_id")},
            {"_id": 0, "id": 1},
        ).to_list(2000)
        allowed_merchant_ids = [str(row.get("id")) for row in reseller_merchants if row.get("id")]
        if not allowed_merchant_ids:
            return {
                "summary": {
                    "impressions": 0,
                    "clicks": 0,
                    "adds": 0,
                    "ctr": 0,
                    "add_rate": 0,
                    "unique_customers": 0,
                },
                "by_location": [],
                "by_customer": [],
            }

    requested_ids: List[str] = []
    if merchant_id:
        requested_ids.append(str(merchant_id))
    if merchant_ids:
        requested_ids.extend([mid.strip() for mid in merchant_ids.split(",") if mid.strip()])

    query: Dict[str, Any] = {}
    if allowed_merchant_ids is not None:
        query["merchant_id"] = {"$in": allowed_merchant_ids}

    if requested_ids:
        requested_set = set(requested_ids)
        if allowed_merchant_ids is not None:
            requested_set &= set(allowed_merchant_ids)
        query["merchant_id"] = {"$in": list(requested_set)}

    created_at_filter: Dict[str, str] = {}
    if start_date:
        created_at_filter["$gte"] = f"{start_date}T00:00:00+00:00"
    if end_date:
        created_at_filter["$lte"] = f"{end_date}T23:59:59.999999+00:00"
    if created_at_filter:
        query["created_at"] = created_at_filter

    events = await db.upsell_events.find(query, {"_id": 0}).to_list(10000)
    if not events:
        return {
            "summary": {
                "impressions": 0,
                "clicks": 0,
                "adds": 0,
                "ctr": 0,
                "add_rate": 0,
                "unique_customers": 0,
            },
            "by_location": [],
            "by_customer": [],
        }

    merchant_ids_seen = sorted({str(event.get("merchant_id")) for event in events if event.get("merchant_id")})
    merchant_docs = await db.merchants.find(
        {"id": {"$in": merchant_ids_seen}},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "license_info": 1,
            "location_name": 1,
            "store_name": 1,
            "license_name": 1,
        },
    ).to_list(len(merchant_ids_seen) or 1)

    merchant_name_lookup: Dict[str, str] = {}
    for merchant in merchant_docs:
        merchant_id_value = str(merchant.get("id") or "")
        if not merchant_id_value:
            continue
        license_info = merchant.get("license_info") or {}
        merchant_name_lookup[merchant_id_value] = (
            license_info.get("license_name")
            or merchant.get("license_name")
            or merchant.get("location_name")
            or merchant.get("store_name")
            or merchant.get("name")
            or f"Merchant {merchant_id_value[-4:]}"
        )

    impression_count = 0
    click_count = 0
    add_count = 0
    summary_customer_keys = set()
    location_stats: Dict[str, Dict[str, Any]] = {}
    customer_stats: Dict[str, Dict[str, Any]] = {}

    for event in events:
        event_type = str(event.get("event_type") or "").lower()
        merchant_id_value = str(event.get("merchant_id") or "")
        location_name = merchant_name_lookup.get(
            merchant_id_value,
            f"Merchant {merchant_id_value[-4:]}" if merchant_id_value else "Unknown",
        )

        email = str(event.get("customer_email") or "").strip().lower()
        phone = str(event.get("customer_phone") or "").strip()
        customer_name = str(event.get("customer_name") or "").strip()

        customer_key = email or phone or "anonymous"
        if customer_key != "anonymous":
            summary_customer_keys.add(customer_key)

        if event_type == "impression":
            impression_count += 1
        elif event_type == "click":
            click_count += 1
        elif event_type == "add":
            add_count += 1

        if merchant_id_value not in location_stats:
            location_stats[merchant_id_value] = {
                "merchant_id": merchant_id_value,
                "location_name": location_name,
                "impressions": 0,
                "clicks": 0,
                "adds": 0,
                "customer_keys": set(),
            }

        if customer_key != "anonymous":
            location_stats[merchant_id_value]["customer_keys"].add(customer_key)

        if event_type == "impression":
            location_stats[merchant_id_value]["impressions"] += 1
        elif event_type == "click":
            location_stats[merchant_id_value]["clicks"] += 1
        elif event_type == "add":
            location_stats[merchant_id_value]["adds"] += 1

        if customer_key not in customer_stats:
            customer_stats[customer_key] = {
                "customer_key": customer_key,
                "customer_name": customer_name,
                "customer_email": email,
                "customer_phone": phone,
                "impressions": 0,
                "clicks": 0,
                "adds": 0,
                "merchant_ids": set(),
            }

        if customer_name and not customer_stats[customer_key]["customer_name"]:
            customer_stats[customer_key]["customer_name"] = customer_name

        if email:
            customer_stats[customer_key]["customer_email"] = email
        if phone:
            customer_stats[customer_key]["customer_phone"] = phone

        if merchant_id_value:
            customer_stats[customer_key]["merchant_ids"].add(merchant_id_value)

        if event_type == "impression":
            customer_stats[customer_key]["impressions"] += 1
        elif event_type == "click":
            customer_stats[customer_key]["clicks"] += 1
        elif event_type == "add":
            customer_stats[customer_key]["adds"] += 1

    by_location = []
    for row in location_stats.values():
        impressions = row["impressions"]
        clicks = row["clicks"]
        adds = row["adds"]
        by_location.append(
            {
                "merchant_id": row["merchant_id"],
                "location_name": row["location_name"],
                "impressions": impressions,
                "clicks": clicks,
                "adds": adds,
                "ctr": round((clicks / impressions) * 100, 2) if impressions > 0 else 0,
                "add_rate": round((adds / impressions) * 100, 2) if impressions > 0 else 0,
                "unique_customers": len(row["customer_keys"]),
            }
        )

    by_location.sort(key=lambda row: (row["adds"], row["impressions"]), reverse=True)

    by_customer = []
    for row in customer_stats.values():
        impressions = row["impressions"]
        clicks = row["clicks"]
        adds = row["adds"]
        merchant_ids_for_customer = sorted(row["merchant_ids"])

        by_customer.append(
            {
                "customer_key": row["customer_key"],
                "customer_name": row["customer_name"] or "Guest",
                "customer_email": row["customer_email"],
                "customer_phone": row["customer_phone"],
                "impressions": impressions,
                "clicks": clicks,
                "adds": adds,
                "ctr": round((clicks / impressions) * 100, 2) if impressions > 0 else 0,
                "add_rate": round((adds / impressions) * 100, 2) if impressions > 0 else 0,
                "merchant_ids": merchant_ids_for_customer,
                "location_count": len(merchant_ids_for_customer),
            }
        )

    by_customer.sort(key=lambda row: (row["adds"], row["impressions"]), reverse=True)

    return {
        "summary": {
            "impressions": impression_count,
            "clicks": click_count,
            "adds": add_count,
            "ctr": round((click_count / impression_count) * 100, 2) if impression_count > 0 else 0,
            "add_rate": round((add_count / impression_count) * 100, 2) if impression_count > 0 else 0,
            "unique_customers": len(summary_customer_keys),
        },
        "by_location": by_location[:limit],
        "by_customer": by_customer[:limit],
    }


# ============== DASHBOARD/STATS ENDPOINTS ==============
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    merchant_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user["role"] == UserRole.MERCHANT.value:
        # Merchants only see their own data
        merchant_ids = current_user.get("merchant_ids", [])
        if not merchant_ids:
            return {
                "total_orders": 0, "today_orders": 0, "pending_orders": 0,
                "total_revenue": 0, "today_revenue": 0, "active_merchants": 0
            }
        query["merchant_id"] = {"$in": merchant_ids}
    elif current_user["role"] == UserRole.RESELLER.value:
        # Resellers only see their portfolio data
        reseller_merchants = await db.merchants.find(
            {"reseller_id": current_user.get("reseller_id")},
            {"id": 1, "_id": 0}
        ).to_list(1000)
        merchant_ids = [m["id"] for m in reseller_merchants]
        if not merchant_ids:
            return {
                "total_orders": 0, "today_orders": 0, "pending_orders": 0,
                "total_revenue": 0, "today_revenue": 0, "active_merchants": len(reseller_merchants)
            }
        query["merchant_id"] = {"$in": merchant_ids}
    elif merchant_id:
        query["merchant_id"] = merchant_id
    
    # Today's date range
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_orders = await db.orders.count_documents(query)
    today_query = {**query, "created_at": {"$gte": today_start.isoformat()}}
    today_orders = await db.orders.count_documents(today_query)
    
    # Revenue calculation
    pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    
    # Today's revenue
    today_pipeline = [
        {"$match": today_query},
        {"$group": {"_id": None, "today_revenue": {"$sum": "$total"}}}
    ]
    today_revenue_result = await db.orders.aggregate(today_pipeline).to_list(1)
    today_revenue = today_revenue_result[0]["today_revenue"] if today_revenue_result else 0
    
    pending_orders = await db.orders.count_documents({**query, "status": OrderStatus.PENDING.value})
    
    return {
        "total_orders": total_orders,
        "today_orders": today_orders,
        "total_revenue": round(total_revenue, 2),
        "today_revenue": round(today_revenue, 2),
        "pending_orders": pending_orders
    }

@api_router.get("/dashboard/admin-stats")
async def get_admin_stats(
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    total_merchants = await db.merchants.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_users = await db.users.count_documents({})
    
    # Revenue
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Active orders (not delivered or cancelled)
    active_orders = await db.orders.count_documents({
        "status": {"$nin": ["delivered", "cancelled"]}
    })
    
    return {
        "total_merchants": total_merchants,
        "total_orders": total_orders,
        "total_users": total_users,
        "total_revenue": round(total_revenue, 2),
        "active_orders": active_orders
    }

# ============== AUDIT LOG ENDPOINTS ==============
@api_router.get("/logs")
async def get_audit_logs(
    merchant_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0),
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    query = {}
    accessible_merchant_ids = await get_accessible_merchant_ids(user)

    if accessible_merchant_ids is not None:
        if not accessible_merchant_ids:
            return {
                "logs": [],
                "pagination": {
                    "total": 0,
                    "limit": limit,
                    "skip": skip,
                    "has_more": False
                }
            }

        if merchant_id:
            if merchant_id not in accessible_merchant_ids:
                raise HTTPException(status_code=403, detail="Access denied")
            query["merchant_id"] = merchant_id
        else:
            query["merchant_id"] = {"$in": accessible_merchant_ids}
    elif merchant_id:
        query["merchant_id"] = merchant_id

    if action:
        query["action"] = action

    # Get total count for pagination
    total_count = await db.audit_logs.count_documents(query)

    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Add pagination metadata to response
    response_data = {
        "logs": logs,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "skip": skip,
            "has_more": skip + len(logs) < total_count
        }
    }

    return response_data

# ============== SHEPHERD API INTEGRATION ==============
@api_router.get("/shepherd/merchants")
async def list_shepherd_merchants(
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Get list of all merchants from Shepherd API"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured. Please set SHEPHERD_BEARER_TOKEN in .env")
    
    try:
        merchants = await shepherd.get_merchants()
        return {"merchants": merchants, "count": len(merchants)}
    except Exception as e:
        logger.error(f"Failed to get Shepherd merchants: {e}")
        raise HTTPException(status_code=503, detail=f"Shepherd API unavailable: {str(e)}. Check your SHEPHERD_BEARER_TOKEN and Shepherd API connectivity.")

@api_router.get("/shepherd/merchants/{shepherd_merchant_id}")
async def get_shepherd_merchant(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """Get details for a specific Shepherd merchant"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    try:
        merchant = await shepherd.get_merchant(shepherd_merchant_id)
        return merchant
    except Exception as e:
        logger.error(f"Failed to get Shepherd merchant: {e}")
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")

@api_router.get("/shepherd/merchants/{shepherd_merchant_id}/menu")
async def get_shepherd_menu(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """Get menu from Shepherd API for a merchant"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    try:
        menu = await shepherd.get_menu(shepherd_merchant_id)
        return menu
    except Exception as e:
        logger.error(f"Failed to get Shepherd menu: {e}")
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")

@api_router.post("/shepherd/sync-menu/{merchant_id}")
async def sync_menu_from_shepherd(
    merchant_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Sync menu from Shepherd API to local database for a merchant.
    This will fetch the menu from Shepherd and update the local categories and items.
    Only imports menus with MenuId starting with "RNOO".
    
    Features:
    - Uses ScheduleId from each menu for time-based filtering
    - Captures TaxRateId for each menu/item
    - Stores ModPrompts with MinMods/MaxMods for modifier enforcement
    - Stores PLU, PosId, PosData for each item
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get merchant and verify shepherd config
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        raise HTTPException(status_code=400, detail="Merchant does not have Shepherd configuration")

    shepherd_menu = {}
    schedules_data = []
    schedules = []
    tax_rates = []
    hqding_info = {}
    transformed = {"categories": [], "items": []}
    reset_shepherd_http_history()
    
    try:
        # Fetch menu, schedules, tax rates, and site snapshots from Shepherd
        shepherd_menu = await shepherd.get_menu(shepherd_merchant_id)
        schedules_data = await shepherd.get_schedules(shepherd_merchant_id)
        tax_rates = await shepherd.get_tax_rates(shepherd_merchant_id)
        hqding_info = await shepherd.get_hqding_info(shepherd_merchant_id)
        normalized_tax_rates = normalize_shepherd_tax_rates_payload(tax_rates)
        tax_rate_map = {
            row.get("tax_rate_id"): float(row.get("rate") or 0.0)
            for row in normalized_tax_rates
            if row.get("tax_rate_id")
        }
        default_tax_rate_id, default_tax_rate_percent = resolve_default_tax_rate(normalized_tax_rates)
        # schedules endpoint returns a list directly, not {"schedules": [...]}
        schedules = schedules_data if isinstance(schedules_data, list) else schedules_data.get("schedules", [])
        
        logger.info(f"Fetched {len(schedules)} schedules from Shepherd")
        
        # Transform to RNOO format - pass schedules for direct ScheduleId matching
        transformed = transform_shepherd_menu_to_rnoo(
            shepherd_menu, 
            merchant_id, 
            shepherd_merchant_id=shepherd_merchant_id,
            rnoo_only=True,
            schedules=schedules
        )

        for item in transformed.get("items", []):
            item_tax_rate_id = item.get("tax_rate_id")
            mapped_rate = tax_rate_map.get(item_tax_rate_id)
            if mapped_rate is None:
                mapped_rate = default_tax_rate_percent
            item["tax_rate_percent"] = normalize_tax_rate_value(mapped_rate) or 0.0
        
        # Clear existing menu data for this merchant
        await db.menu_categories.delete_many({"merchant_id": merchant_id})
        await db.menu_items.delete_many({"merchant_id": merchant_id})
        
        # Insert new categories
        categories_inserted = 0
        scheduled_categories = 0
        if transformed["categories"]:
            for cat in transformed["categories"]:
                cat["created_at"] = datetime.now(timezone.utc).isoformat()
                if cat.get("schedule_name"):
                    scheduled_categories += 1
            await db.menu_categories.insert_many(transformed["categories"])
            categories_inserted = len(transformed["categories"])
        
        # Insert new items
        items_inserted = 0
        if transformed["items"]:
            for item in transformed["items"]:
                item["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.menu_items.insert_many(transformed["items"])
            items_inserted = len(transformed["items"])
        
        # Update merchant's last sync timestamp
        await db.merchants.update_one(
            {"id": merchant_id},
            {
                "$set": {
                    "last_menu_sync": datetime.now(timezone.utc).isoformat(),
                    "default_tax_rate_id": default_tax_rate_id,
                    "default_tax_rate_percent": default_tax_rate_percent,
                    "shepherd_tax_rates": normalized_tax_rates,
                    "tax_rates_last_synced": datetime.now(timezone.utc).isoformat(),
                }
            }
        )
        
        # Log the sync
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": merchant_id,
            "action": "menu_sync_from_shepherd",
            "endpoint": f"/api/shepherd/sync-menu/{merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
                "categories_synced": categories_inserted,
                "items_synced": items_inserted,
                "scheduled_categories": scheduled_categories,
                "rnoo_filter": True,
                "transform_summary": build_menu_sync_summary(transformed, shepherd_menu, schedules, tax_rates, hqding_info)
            },
            "response_data": {
                "raw_menu_json": shepherd_menu,
                "raw_schedules_json": schedules_data,
                "raw_tax_rates_json": tax_rates,
                "raw_hqding_json": hqding_info,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Menu synced successfully from Shepherd (RNOO menus only)",
            "categories_synced": categories_inserted,
            "items_synced": items_inserted,
            "scheduled_categories": scheduled_categories,
            "shepherd_merchant_id": shepherd_merchant_id
        }
        
    except Exception as e:
        logger.error(f"Failed to sync menu from Shepherd: {e}")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": merchant_id,
            "action": "menu_sync_from_shepherd_failed",
            "endpoint": f"/api/shepherd/sync-menu/{merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
                "rnoo_filter": True,
                "transform_summary": build_menu_sync_summary(transformed, shepherd_menu, schedules, tax_rates, hqding_info)
            },
            "response_data": {
                "raw_menu_json": shepherd_menu,
                "raw_schedules_json": schedules_data,
                "raw_tax_rates_json": tax_rates,
                "raw_hqding_json": hqding_info,
                "shepherd_http_calls": get_shepherd_http_history(reset=True),
                "error": str(e)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        raise HTTPException(status_code=500, detail=f"Menu sync failed: {str(e)}")

@api_router.post("/shepherd/submit-order/{order_id}")
async def submit_order_to_shepherd(
    order_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """Submit an order to Shepherd API for POS injection"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get the order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get merchant shepherd config
    merchant = await db.merchants.find_one({"id": order["merchant_id"]}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        raise HTTPException(status_code=400, detail="Merchant does not have Shepherd configuration")

    shepherd_order = None
    reset_shepherd_http_history()

    try:
        # Build Shepherd order format
        shepherd_order = build_shepherd_order(order, shepherd_config)
        request_payload = build_order_integration_log_payload(
            order,
            merchant,
            shepherd_merchant_id=shepherd_merchant_id,
            shepherd_order=shepherd_order
        )
        
        # Submit to Shepherd
        result = await shepherd.submit_order(shepherd_merchant_id, shepherd_order)
        
        # Update order with Shepherd reference
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "shepherd_submitted": True,
                "shepherd_response": result,
                "shepherd_submitted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log the submission
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_submitted_to_shepherd",
            "endpoint": f"/api/shepherd/submit-order/{order_id}",
            "request_data": request_payload,
            "response_data": {
                "shepherd_response": result,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "Order submitted to Shepherd successfully",
            "order_id": order_id,
            "shepherd_response": result
        }
        
    except Exception as e:
        logger.error(f"Failed to submit order to Shepherd: {e}")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": order["merchant_id"],
            "action": "order_submit_to_shepherd_failed",
            "endpoint": f"/api/shepherd/submit-order/{order_id}",
            "request_data": build_order_integration_log_payload(
                order,
                merchant,
                shepherd_merchant_id=shepherd_merchant_id,
                shepherd_order=shepherd_order
            ),
            "response_data": {
                "error": str(e),
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        raise HTTPException(status_code=500, detail=f"Order submission failed: {str(e)}")

@api_router.get("/shepherd/orders/{shepherd_merchant_id}")
async def get_shepherd_orders(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """Get orders from Shepherd API for a merchant"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    try:
        orders = await shepherd.get_orders(shepherd_merchant_id)
        return {"orders": orders, "count": len(orders) if isinstance(orders, list) else 0}
    except Exception as e:
        logger.error(f"Failed to get Shepherd orders: {e}")
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")

@api_router.get("/shepherd/merchants/{shepherd_merchant_id}/schedules")
async def get_shepherd_schedules(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """Get menu schedules from Shepherd API for a merchant"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    try:
        schedules = await shepherd.get_schedules(shepherd_merchant_id)
        return {"schedules": schedules}
    except Exception as e:
        logger.error(f"Failed to get Shepherd schedules: {e}")
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")

@api_router.get("/shepherd/merchants/{shepherd_merchant_id}/taxrates")
async def get_shepherd_tax_rates(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """Get tax rates from Shepherd API for a merchant"""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")

    try:
        tax_rates = await shepherd.get_tax_rates(shepherd_merchant_id)
        return {"tax_rates": tax_rates}
    except Exception as e:
        logger.error(f"Failed to get Shepherd tax rates: {e}")
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")

@api_router.post("/shepherd/sync-license/{merchant_id}")
async def sync_license_from_shepherd(
    merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER, UserRole.MERCHANT]))
):
    """
    Sync license/merchant info from Shepherd API.
    Updates the merchant with license name, address, phone, etc.
    """
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    
    # Get merchant and verify shepherd config
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    shepherd_config = merchant.get("shepherd_config", {})
    shepherd_merchant_id = shepherd_config.get("merchant_id")
    
    if not shepherd_merchant_id:
        raise HTTPException(status_code=400, detail="Merchant does not have Shepherd configuration")

    shepherd_data = {}
    hqding_info = {}
    reset_shepherd_http_history()
    
    try:
        # Fetch merchant details from Shepherd
        shepherd_data = await shepherd.get_merchant(shepherd_merchant_id)
        hqding_info = await shepherd.get_hqding_info(shepherd_merchant_id)
        
        # Extract license info from response
        license_info = {}
        
        if isinstance(shepherd_data, dict):
            # Use 'location' field as license name (the primary identifier from Shepherd)
            location = shepherd_data.get("location")
            if location:
                license_info["license_name"] = location
            
            # Try common field names for other info
            license_info["license_name"] = (
                shepherd_data.get("LicenseName") or 
                shepherd_data.get("Name") or 
                shepherd_data.get("MerchantName") or
                shepherd_data.get("StoreName") or
                shepherd_data.get("location")  # Fallback to location
            )
            license_info["address_line1"] = (
                shepherd_data.get("Address") or 
                shepherd_data.get("AddressLine1") or
                shepherd_data.get("Street")
            )
            license_info["address_line2"] = shepherd_data.get("AddressLine2") or shepherd_data.get("Address2")
            license_info["city"] = shepherd_data.get("City")
            license_info["state"] = shepherd_data.get("State") or shepherd_data.get("StateProvince")
            license_info["zip_code"] = shepherd_data.get("ZipCode") or shepherd_data.get("PostalCode") or shepherd_data.get("Zip")
            license_info["phone"] = shepherd_data.get("Phone") or shepherd_data.get("PhoneNumber") or shepherd_data.get("Telephone")
            license_info["website"] = shepherd_data.get("Website") or shepherd_data.get("WebsiteUrl") or shepherd_data.get("URL")
            license_info["contact_name"] = shepherd_data.get("ContactName") or shepherd_data.get("Contact")
            license_info["contact_email"] = shepherd_data.get("ContactEmail") or shepherd_data.get("Email")
            license_info["logo_url"] = (
                shepherd_data.get("MerchantSiteLogo") or 
                shepherd_data.get("LogoUrl") or 
                shepherd_data.get("Logo") or
                shepherd_data.get("SiteLogo")
            )
            
            # Store shepherd version info for reference
            license_info["shepherd_version"] = shepherd_data.get("version")
            license_info["shepherd_sn"] = shepherd_data.get("sn")
        
        # Remove None values
        license_info = {k: v for k, v in license_info.items() if v is not None}
        
        # Update merchant with license info
        update_data = {"license_info": license_info}
        
        # Also update branding logo if found
        if license_info.get("logo_url"):
            update_data["branding.logo_url"] = license_info["logo_url"]
        
        # Update merchant name if license_name is available and different
        if license_info.get("license_name"):
            update_data["name"] = license_info["license_name"]
        
        await db.merchants.update_one(
            {"id": merchant_id},
            {"$set": update_data}
        )
        
        # Log the sync
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": merchant_id,
            "action": "license_sync_from_shepherd",
            "endpoint": f"/api/shepherd/sync-license/{merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
                "license_info_fields": list(license_info.keys())
            },
            "response_data": {
                "raw_shepherd_data": shepherd_data,
                "raw_hqding_json": hqding_info,
                "shepherd_http_calls": get_shepherd_http_history(reset=True)
            },
            "status_code": 200,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "message": "License info synced from Shepherd",
            "license_info": license_info,
            "shepherd_merchant_id": shepherd_merchant_id,
            "raw_shepherd_data": shepherd_data
        }
        
    except Exception as e:
        logger.error(f"Failed to sync license from Shepherd: {e}")

        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.get("id"),
            "merchant_id": merchant_id,
            "action": "license_sync_from_shepherd_failed",
            "endpoint": f"/api/shepherd/sync-license/{merchant_id}",
            "request_data": {
                "shepherd_merchant_id": shepherd_merchant_id,
            },
            "response_data": {
                "raw_shepherd_data": shepherd_data,
                "raw_hqding_json": hqding_info,
                "shepherd_http_calls": get_shepherd_http_history(reset=True),
                "error": str(e)
            },
            "status_code": 500,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        raise HTTPException(status_code=500, detail=f"License sync failed: {str(e)}")

@api_router.put("/merchants/{merchant_id}/link-shepherd")
async def link_merchant_to_shepherd(
    merchant_id: str,
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """Link a local merchant to a Shepherd merchant ID"""
    merchant = await db.merchants.find_one({"id": merchant_id}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    old_shepherd_id = merchant.get("shepherd_config", {}).get("merchant_id")
    
    # Update shepherd config
    shepherd_config = merchant.get("shepherd_config") or {}
    shepherd_config["merchant_id"] = shepherd_merchant_id
    
    await db.merchants.update_one(
        {"id": merchant_id},
        {"$set": {"shepherd_config": shepherd_config}}
    )
    
    # Log the link action
    await log_audit(
        action="merchant_shepherd_linked",
        endpoint=f"/api/merchants/{merchant_id}/link-shepherd",
        user=user,
        merchant_id=merchant_id,
        request_data={
            "merchant_name": merchant.get("name"),
            "old_shepherd_id": old_shepherd_id,
            "new_shepherd_id": shepherd_merchant_id
        }
    )
    
    return {
        "message": f"Merchant linked to Shepherd merchant {shepherd_merchant_id}",
        "merchant_id": merchant_id,
        "shepherd_merchant_id": shepherd_merchant_id
    }

# ============== SHEPHERD WEBHOOK RECEIVER & MANAGEMENT ==============

@api_router.post("/webhooks/shepherd/{shepherd_merchant_id}")
async def receive_shepherd_webhook(shepherd_merchant_id: str, request: Request):
    """
    Receive Shepherd push webhook events.
    Shepherd POSTs here when subscribed events fire (ORDERSTATUSUPDATE, MENUUPDATE, NEWORDER).
    No authentication required — Shepherd does not send our token back.
    In production, restrict this path by IP at the reverse-proxy level.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    event_type = (
        body.get("eventType") or body.get("EventType") or
        body.get("event") or body.get("Event") or
        body.get("event_type") or body.get("type") or ""
    ).upper()

    logger.info(f"Shepherd webhook received: merchant={shepherd_merchant_id} event={event_type} payload={body}")

    if event_type == "ORDERSTATUSUPDATE":
        asyncio.create_task(_handle_shepherd_order_status_update(shepherd_merchant_id, body))
    elif event_type == "MENUUPDATE":
        asyncio.create_task(_handle_shepherd_menu_update(shepherd_merchant_id))
    elif event_type == "NEWORDER":
        logger.info(f"Shepherd NEWORDER event for merchant {shepherd_merchant_id} (informational)")
    else:
        logger.info(f"Shepherd webhook unhandled event type '{event_type}' for merchant {shepherd_merchant_id}")

    return {"received": True, "merchant": shepherd_merchant_id, "event": event_type}


@api_router.get("/shepherd/merchants/{shepherd_merchant_id}/webhooks/events")
async def list_shepherd_webhook_events(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """List available webhook event types for a Shepherd merchant."""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    try:
        events = await shepherd.get_webhook_events(shepherd_merchant_id)
        return {"events": events, "shepherd_merchant_id": shepherd_merchant_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")


@api_router.get("/shepherd/merchants/{shepherd_merchant_id}/webhooks/subscriptions")
async def list_shepherd_webhook_subscriptions(
    shepherd_merchant_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.RESELLER]))
):
    """List current webhook subscriptions for a Shepherd merchant."""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    try:
        subscriptions = await shepherd.get_webhook_subscriptions(shepherd_merchant_id)
        return {"subscriptions": subscriptions, "shepherd_merchant_id": shepherd_merchant_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shepherd API error: {str(e)}")


@api_router.post("/shepherd/merchants/{shepherd_merchant_id}/webhooks/subscribe")
async def subscribe_to_shepherd_webhook(
    shepherd_merchant_id: str,
    event_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Subscribe to a Shepherd webhook event for a merchant."""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    if not WEBHOOK_BASE_URL:
        raise HTTPException(status_code=400, detail="WEBHOOK_BASE_URL not configured in .env — Shepherd needs a public URL to POST to")
    try:
        callback_url = f"{WEBHOOK_BASE_URL}/api/webhooks/shepherd/{shepherd_merchant_id}"
        result = await shepherd.subscribe_webhook_event(shepherd_merchant_id, event_id, callback_url)
        return {"subscribed": True, "event": event_id, "callback_url": callback_url, "response": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subscription failed: {str(e)}")


@api_router.delete("/shepherd/merchants/{shepherd_merchant_id}/webhooks/{event_id}")
async def unsubscribe_from_shepherd_webhook(
    shepherd_merchant_id: str,
    event_id: str,
    user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Unsubscribe from a Shepherd webhook event for a merchant."""
    shepherd = get_shepherd_client()
    if not shepherd:
        raise HTTPException(status_code=503, detail="Shepherd API not configured")
    try:
        result = await shepherd.unsubscribe_webhook_event(shepherd_merchant_id, event_id)
        return {"unsubscribed": True, "event": event_id, "response": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unsubscription failed: {str(e)}")


# ============== HEALTH CHECK ==============
@api_router.get("/")
async def root():
    return {"message": "RPOWER Native Online Ordering API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== SEED DATA ENDPOINT (DEV) ==============
@api_router.post("/seed")
async def seed_database():
    """Seed database with demo data for development"""
    
    # Check if already seeded
    existing_admin = await db.users.find_one({"email": "admin@rpower.com"})
    if existing_admin:
        return {"message": "Database already seeded"}
    
    # Create Super Admin
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": admin_id,
        "email": "admin@rpower.com",
        "first_name": "RPOWER",
        "last_name": "Admin",
        "name": "RPOWER Admin",
        "phone": "555-0101",
        "role": UserRole.SUPER_ADMIN.value,
        "password": hash_password("admin123"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create Reseller
    reseller_id = str(uuid.uuid4())
    await db.resellers.insert_one({
        "id": reseller_id,
        "name": "Demo Reseller",
        "contact_email": "reseller@demo.com",
        "contact_phone": "555-0100",
        "company_name": "Demo Restaurant Group",
        "is_active": True,
        "merchant_count": 1,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create Reseller User
    reseller_user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": reseller_user_id,
        "email": "reseller@demo.com",
        "first_name": "Demo",
        "last_name": "Reseller",
        "name": "Demo Reseller",
        "phone": "555-0100",
        "role": UserRole.RESELLER.value,
        "reseller_id": reseller_id,
        "password": hash_password("reseller123"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create Merchant
    merchant_id = str(uuid.uuid4())
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    store_hours = [
        {"day": d, "open_time": "09:00", "close_time": "21:00", "is_closed": (d == "Sunday")}
        for d in days
    ]
    
    await db.merchants.insert_one({
        "id": merchant_id,
        "reseller_id": reseller_id,
        "name": "Demo Burger Joint",
        "slug": "demo-burger-joint",
        "address_line1": "123 Main Street",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78701",
        "phone": "512-555-0123",
        "email": "info@demoburger.com",
        "description": "The best burgers in town! Fresh ingredients, made to order.",
        "is_active": True,
        "is_open": True,
        "store_hours": store_hours,
        "branding": {
            "logo_url": None,
            "primary_color": "#7C3AED",
            "secondary_color": "#111827",
            "font_family": "Manrope",
            "banner_url": "https://images.pexels.com/photos/2271107/pexels-photo-2271107.jpeg"
        },
        "price_bump_percentage": 0.0,
        "price_bump_fixed": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create Merchant User
    merchant_user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": merchant_user_id,
        "email": "merchant@demo.com",
        "first_name": "Demo",
        "last_name": "Merchant",
        "name": "Demo Merchant",
        "phone": "555-0102",
        "role": UserRole.MERCHANT.value,
        "merchant_id": merchant_id,
        "password": hash_password("merchant123"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create Menu Categories
    categories = [
        {"id": str(uuid.uuid4()), "merchant_id": merchant_id, "name": "Burgers", "description": "Handcrafted burgers", "display_order": 1, "is_active": True, "image_url": "https://images.pexels.com/photos/2271107/pexels-photo-2271107.jpeg"},
        {"id": str(uuid.uuid4()), "merchant_id": merchant_id, "name": "Sides", "description": "Delicious sides", "display_order": 2, "is_active": True, "image_url": "https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg"},
        {"id": str(uuid.uuid4()), "merchant_id": merchant_id, "name": "Drinks", "description": "Refreshing beverages", "display_order": 3, "is_active": True, "image_url": "https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg"},
    ]
    await db.menu_categories.insert_many(categories)
    
    burger_cat_id = categories[0]["id"]
    sides_cat_id = categories[1]["id"]
    drinks_cat_id = categories[2]["id"]
    
    # Create Menu Items with Modifiers
    menu_items = [
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": burger_cat_id,
            "name": "Classic Burger",
            "description": "Angus beef patty with lettuce, tomato, onion, and our special sauce",
            "plu": "1001",
            "price": 12.99,
            "image_url": "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg",
            "is_available": True,
            "modifier_groups": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Patty Temperature",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Medium Rare", "plu": "M1", "price": 0, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Medium", "plu": "M2", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Well Done", "plu": "M3", "price": 0, "is_default": False}
                    ]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Add Toppings",
                    "min_selections": 0,
                    "max_selections": 5,
                    "is_required": False,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Bacon", "plu": "T1", "price": 2.50, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Cheese", "plu": "T2", "price": 1.50, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Avocado", "plu": "T3", "price": 2.00, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Jalapeños", "plu": "T4", "price": 0.75, "is_default": False}
                    ]
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": burger_cat_id,
            "name": "BBQ Bacon Burger",
            "description": "Topped with crispy bacon, cheddar, onion rings, and BBQ sauce",
            "plu": "1002",
            "price": 15.99,
            "image_url": "https://images.pexels.com/photos/3616956/pexels-photo-3616956.jpeg",
            "is_available": True,
            "modifier_groups": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Patty Temperature",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Medium", "plu": "M2", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Well Done", "plu": "M3", "price": 0, "is_default": False}
                    ]
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": burger_cat_id,
            "name": "Veggie Burger",
            "description": "House-made black bean patty with fresh vegetables",
            "plu": "1003",
            "price": 11.99,
            "image_url": "https://images.pexels.com/photos/1251198/pexels-photo-1251198.jpeg",
            "is_available": True,
            "modifier_groups": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": sides_cat_id,
            "name": "French Fries",
            "description": "Crispy golden fries with sea salt",
            "plu": "2001",
            "price": 4.99,
            "image_url": "https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg",
            "is_available": True,
            "modifier_groups": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Size",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Regular", "plu": "S1", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Large", "plu": "S2", "price": 1.50, "is_default": False}
                    ]
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": sides_cat_id,
            "name": "Onion Rings",
            "description": "Beer-battered onion rings",
            "plu": "2002",
            "price": 5.99,
            "image_url": "https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg",
            "is_available": True,
            "modifier_groups": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": drinks_cat_id,
            "name": "Soft Drink",
            "description": "Choice of Coke, Sprite, or Dr Pepper",
            "plu": "3001",
            "price": 2.99,
            "image_url": "https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg",
            "is_available": True,
            "modifier_groups": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Choice",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Coke", "plu": "D1", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Sprite", "plu": "D2", "price": 0, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Dr Pepper", "plu": "D3", "price": 0, "is_default": False}
                    ]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Size",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Small", "plu": "DS1", "price": 0, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Medium", "plu": "DS2", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Large", "plu": "DS3", "price": 0.75, "is_default": False}
                    ]
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "merchant_id": merchant_id,
            "category_id": drinks_cat_id,
            "name": "Milkshake",
            "description": "Creamy hand-spun milkshake",
            "plu": "3002",
            "price": 5.99,
            "image_url": "https://images.pexels.com/photos/3727250/pexels-photo-3727250.jpeg",
            "is_available": True,
            "modifier_groups": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Flavor",
                    "min_selections": 1,
                    "max_selections": 1,
                    "is_required": True,
                    "options": [
                        {"id": str(uuid.uuid4()), "name": "Chocolate", "plu": "MS1", "price": 0, "is_default": True},
                        {"id": str(uuid.uuid4()), "name": "Vanilla", "plu": "MS2", "price": 0, "is_default": False},
                        {"id": str(uuid.uuid4()), "name": "Strawberry", "plu": "MS3", "price": 0, "is_default": False}
                    ]
                }
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.menu_items.insert_many(menu_items)
    
    return {
        "message": "Database seeded successfully",
        "credentials": {
            "super_admin": {"email": "admin@rpower.com", "password": "admin123"},
            "reseller": {"email": "reseller@demo.com", "password": "reseller123"},
            "merchant": {"email": "merchant@demo.com", "password": "merchant123"}
        },
        "demo_merchant_slug": "demo-burger-joint"
    }

# Include router and setup middleware
app.include_router(api_router)

# Setup CORS middleware
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    # For development, allow all origins
    cors_list = ["*"]
else:
    cors_list = [origin.strip() for origin in cors_origins.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False if cors_origins == '*' else True,
    allow_origins=cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== WEBSOCKET ENDPOINTS ==============
# Note: WebSocket endpoints use /api prefix to work through Kubernetes ingress
@app.websocket("/api/ws/orders/{merchant_id}")
async def websocket_merchant_orders(websocket: WebSocket, merchant_id: str):
    """
    WebSocket endpoint for merchant-specific order notifications.
    Merchants connect to receive real-time updates for their orders.
    """
    await ws_manager.connect(websocket, merchant_id=merchant_id)
    try:
        while True:
            # Keep connection alive and wait for messages
            data = await websocket.receive_text()
            # Handle ping/pong for keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, merchant_id=merchant_id)
        logger.info(f"Merchant {merchant_id} WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for merchant {merchant_id}: {e}")
        ws_manager.disconnect(websocket, merchant_id=merchant_id)


@app.websocket("/api/ws/admin/orders")
async def websocket_admin_orders(websocket: WebSocket):
    """
    WebSocket endpoint for admin order notifications.
    Admins receive real-time updates for ALL orders across all merchants.
    """
    await ws_manager.connect(websocket, is_admin=True)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, is_admin=True)
        logger.info("Admin WebSocket disconnected")
    except Exception as e:
        logger.error(f"Admin WebSocket error: {e}")
        ws_manager.disconnect(websocket, is_admin=True)


# ============== BACKGROUND ORDER STATUS SYNC ==============
# Configuration for background sync
ORDER_STATUS_SYNC_INTERVAL_SECONDS = int(os.environ.get('ORDER_STATUS_SYNC_INTERVAL', 60))  # Default 60 seconds
_background_sync_task = None
_shutdown_event = asyncio.Event()


async def sync_order_statuses_background():
    """
    Background task that periodically syncs order statuses from Shepherd/POS.
    Runs continuously until shutdown is triggered.
    """
    logger.info(f"Starting background order status sync (interval: {ORDER_STATUS_SYNC_INTERVAL_SECONDS}s)")
    
    while not _shutdown_event.is_set():
        try:
            shepherd = get_shepherd_client()
            if not shepherd:
                logger.debug("Shepherd not configured, skipping background sync")
                await asyncio.sleep(ORDER_STATUS_SYNC_INTERVAL_SECONDS)
                continue
            
            # Find orders that need status sync:
            # - Submitted to Shepherd (shepherd_submitted=True)
            # - Have a shepherd_order_id
            # - Not in final state (DELIVERED or CANCELLED)
            query = {
                "shepherd_submitted": True,
                "shepherd_order_id": {"$ne": None, "$exists": True},
                "status": {"$nin": [OrderStatus.DELIVERED.value, OrderStatus.CANCELLED.value]}
            }
            
            orders = await db.orders.find(query, {"_id": 0}).to_list(50)
            
            if orders:
                logger.info(f"Background sync: Found {len(orders)} orders to check")
            
            synced_count = 0
            for order in orders:
                if _shutdown_event.is_set():
                    break
                    
                try:
                    # Get merchant's Shepherd config
                    merchant = await db.merchants.find_one(
                        {"id": order["merchant_id"]}, 
                        {"_id": 0, "shepherd_config": 1}
                    )
                    if not merchant:
                        continue
                    
                    shepherd_config = merchant.get("shepherd_config", {})
                    shepherd_merchant_id = shepherd_config.get("merchant_id")
                    
                    if not shepherd_merchant_id:
                        continue
                    
                    response, used_ref = await get_shepherd_order_status_response(shepherd, shepherd_merchant_id, order)
                    
                    shepherd_status_raw = extract_shepherd_status(response)
                    shepherd_status = shepherd_status_raw.lower()
                    
                    new_status = map_shepherd_status_to_internal(shepherd_status, order.get("status"))
                    old_status = order.get("status")
                    
                    logger.info(f"Background sync: Order {order['id'][:8]} extracted '{shepherd_status_raw}' -> '{new_status}' (was '{old_status}')")
                    
                    # Prepare update
                    update_data = {
                        "shepherd_status": shepherd_status_raw,
                        "shepherd_status_updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Only update internal status if it actually changed
                    status_changed = new_status != old_status
                    if status_changed:
                        update_data["status"] = new_status
                        logger.info(f"Background sync: Updating order {order['id'][:8]} status to '{new_status}'")
                    
                    await db.orders.update_one({"id": order["id"]}, {"$set": update_data})
                    
                    # Broadcast status change via WebSocket if status changed
                    if status_changed:
                        await log_audit(
                            action="order_status_synced_from_shepherd",
                            endpoint="background_task",
                            merchant_id=order["merchant_id"],
                            request_data={
                                "order_id": order["id"],
                                "order_number": order.get("order_number"),
                                "old_status": old_status,
                                "new_status": new_status,
                                "shepherd_status_raw": shepherd_status_raw,
                                "shepherd_order_ref": used_ref,
                            },
                            response_data={
                                "status_changed": True,
                            },
                            status_code=200,
                        )

                        updated_order = await db.orders.find_one({"id": order["id"]}, {"_id": 0})
                        if updated_order:
                            await ws_manager.broadcast_order_event(
                                f"order_status_{new_status}",
                                updated_order,
                                order["merchant_id"]
                            )
                        logger.info(f"Background sync: Order {order['id'][:8]} status changed {old_status} -> {new_status}")
                    
                    synced_count += 1
                    
                except Exception as e:
                    logger.error(f"Background sync: Failed to sync order {order.get('id', 'unknown')}: {e}")
                    continue
            
            if synced_count > 0:
                logger.info(f"Background sync: Synced {synced_count} orders")
            
        except Exception as e:
            logger.error(f"Background sync error: {e}")
        
        # Wait for next sync interval (or shutdown)
        try:
            await asyncio.wait_for(
                _shutdown_event.wait(), 
                timeout=ORDER_STATUS_SYNC_INTERVAL_SECONDS
            )
        except asyncio.TimeoutError:
            # Timeout means we should continue the loop
            pass
    
    logger.info("Background order status sync stopped")



