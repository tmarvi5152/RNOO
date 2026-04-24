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
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum
import httpx
import xml.etree.ElementTree as ET
import json

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
if SHEPHERD_BEARER_TOKEN:
    init_shepherd_client(SHEPHERD_BEARER_TOKEN)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rnoo-super-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    global _background_sync_task
    
    logger.info("Application starting up...")
    
    # Start the background order status sync task
    _background_sync_task = asyncio.create_task(sync_order_statuses_background())
    logger.info("Background order status sync task started")
    
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

    for key in ("merchant_id", "merchantId", "shepherd_merchant_id", "shepherdMerchantId"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value

    raw_json = payload.get("raw_json")
    if isinstance(raw_json, dict):
        return extract_merchant_id_from_payload(raw_json)

    return None


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


@app.middleware("http")
async def capture_provider_webhook_payloads(request: Request, call_next):
    if not is_provider_webhook_path(request.url.path):
        return await call_next(request)

    raw_body = await request.body()
    content_type = request.headers.get("content-type", "")
    parsed_payload = parse_provider_payload(raw_body, content_type)

    async def receive():
        return {"type": "http.request", "body": raw_body, "more_body": False}

    request._receive = receive

    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "merchant_id": extract_merchant_id_from_payload(parsed_payload),
            "action": "provider_webhook_received",
            "endpoint": request.url.path,
            "request_data": {
                "provider": extract_provider_name_from_path(request.url.path),
                "method": request.method,
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
    name: str
    role: UserRole
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str
    reseller_id: Optional[str] = None
    merchant_id: Optional[str] = None

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reseller_id: Optional[str] = None
    merchant_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    email: EmailStr
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
    clerk_id: str = "8888"
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

    if role == UserRole.MERCHANT.value:
        return user.get("merchant_ids", [])

    if role == UserRole.RESELLER.value:
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
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump()
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
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
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
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = data.model_dump()
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
    return items

@api_router.get("/menu/item/{item_id}", response_model=MenuItem)
async def get_menu_item(item_id: str):
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
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
        
        # Generate order reference
        order_ref = f"RNOO-{order_dict.get('order_number', 0)}-{order_id[:8]}"
        
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
    # Enrich cart payload from synced menu data so pn/plu can be sent to Shepherd
    menu_item_ids = list({item.menu_item_id for item in data.items if item.menu_item_id})
    menu_items_lookup = {}
    if menu_item_ids:
        menu_docs = await db.menu_items.find(
            {"id": {"$in": menu_item_ids}},
            {"_id": 0, "id": 1, "plu": 1, "pos_id": 1, "modifier_groups": 1}
        ).to_list(1000)
        menu_items_lookup = {doc.get("id"): doc for doc in menu_docs}

    for item in data.items:
        menu_doc = menu_items_lookup.get(item.menu_item_id, {})

        if not item.plu:
            item.plu = menu_doc.get("plu") or ""

        if not item.shepherd_pos_id:
            item.shepherd_pos_id = menu_doc.get("pos_id") or ""

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

    # Calculate totals
    subtotal = 0.0
    for item in data.items:
        modifier_total = sum(m.price for m in item.modifiers)
        subtotal += (item.unit_price + modifier_total) * item.quantity
    
    tax = subtotal * 0.0825  # 8.25% tax
    total = subtotal + tax + data.payment.tip
    
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
        subtotal=round(subtotal, 2),
        tax=round(tax, 2),
        tip=data.payment.tip,
        total=round(total, 2),
        payment=data.payment,
        order_timing=data.order_timing,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        need_datetime=need_datetime,
        notes=data.notes,
        status=OrderStatus.PENDING
    )
    
    # Mock payment processing
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
        "request_data": {"order_id": order.id, "total": order.total},
        "status_code": 201,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Broadcast new order via WebSocket
    await ws_manager.broadcast_order_event("new_order", doc, data.merchant_id)
    
    # Get merchant for Shepherd config
    merchant = await db.merchants.find_one({"id": data.merchant_id}, {"_id": 0})
    
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
        return {
            "merchant_id": merchant_id,
            "shepherd_linked": False,
            "message": "Merchant is not linked to Shepherd"
        }
    
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

    # Try to fetch tax data from RPOWER Core API (GetStoreTaxByStore fallback set)
    try:
        if core_client is None:
            core_client = get_rpower_core_client()

        if core_client and core_client.token:
            site_summary = result.get("site_summary") or {}
            core_store_id = site_summary.get("rpower_store_id")
            core_site_code = site_summary.get("rpower_site_code")
            rpower_cg = shepherd_config.get("rpower_cg")

            if core_store_id or core_site_code or rpower_cg:
                core_tax = await core_client.get_store_tax_by_store(
                    store_id=core_store_id,
                    site_code=core_site_code,
                    cg=rpower_cg,
                )
                result["shepherd_data"]["rpower_tax_rates"] = core_tax
            else:
                result["shepherd_data"]["rpower_tax_rates"] = {
                    "error": "No Core store identifiers available for tax lookup"
                }
    except Exception as e:
        logger.warning(f"Failed to fetch RPOWER Core API tax info: {e}")
        result["shepherd_data"]["rpower_tax_rates"] = {"error": str(e)}
    
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
        # Fetch tax rates
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
            {"$set": {"last_menu_sync": datetime.now(timezone.utc).isoformat()}}
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
        "name": "RPOWER Admin",
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
        "name": "Demo Reseller",
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
        "name": "Demo Merchant",
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



