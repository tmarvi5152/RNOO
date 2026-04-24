"""
Shepherd API Client for RPOWER Integration
Handles menu sync and order injection via the Shepherd middleware.
"""
import httpx
import logging
import contextvars
import json
import time
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
import os
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

_shepherd_http_history: contextvars.ContextVar[Optional[List[dict]]] = contextvars.ContextVar(
    "shepherd_http_history",
    default=None,
)

SHEPHERD_BASE_URL = "https://remote.securerpower.com/posapi"
SHEPHERD_MEDIA_URL = "https://remote.securerpower.com/shepherd/media"
RPOWER_CORE_API_URL = "https://rpowerpos.com/api/v1/coreapi"


def reset_shepherd_http_history() -> None:
    _shepherd_http_history.set([])


def append_shepherd_http_history(entry: dict) -> None:
    history = list(_shepherd_http_history.get() or [])
    history.append(entry)
    _shepherd_http_history.set(history)


def get_shepherd_http_history(reset: bool = False) -> List[dict]:
    history = list(_shepherd_http_history.get() or [])
    if reset:
        _shepherd_http_history.set([])
    return history


def parse_httpx_response_body(response: httpx.Response) -> Any:
    if not response.content:
        return {}

    content_type = response.headers.get("content-type", "")
    text_body = response.text

    if "json" in content_type:
        try:
            return response.json()
        except json.JSONDecodeError:
            return text_body

    return text_body


class RPowerCoreAPIClient:
    """
    Client for the RPOWER Core API (rpowerpos.com).
    Uses the same bearer token as Shepherd API.
    """
    
    def __init__(self, token: str = None):
        # Use same token as Shepherd API
        self.token = token or os.environ.get("SHEPHERD_BEARER_TOKEN")
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"
    
    async def get_store_by_cg(self, cg: str, sort_order: str = "name", page_number: int = 1) -> dict:
        """
        Get store information from RPOWER Core API by Customer Group (CG).
        Endpoint: /store/getbycg
        
        Args:
            cg: Customer Group code
            sort_order: Sort order (default: "name")
            page_number: Page number for pagination (default: 1)
        """
        url = f"{RPOWER_CORE_API_URL}/store/getbycg"
        params = {
            "cg": cg,
            "sortorder": sort_order,
            "pagenumber": page_number
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers, params=params)
                logger.info(f"RPOWER Core API (GetStoreByCg) response: {response.status_code} for CG={cg}")
                
                # Check if we got HTML (login page) instead of JSON
                content_type = response.headers.get("content-type", "")
                if "text/html" in content_type:
                    logger.warning("RPOWER Core API returned HTML - likely auth redirect")
                    return {"error": "Authentication required"}
                
                # Handle non-200 responses
                if response.status_code != 200:
                    try:
                        error_data = response.json()
                        logger.warning(f"RPOWER Core API error response: {error_data}")
                        return {"error": str(error_data)}
                    except:
                        return {"error": f"API error: {response.status_code}"}
                
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"RPOWER Core API error: {e.response.status_code}")
            return {"error": f"API error: {e.response.status_code}"}
        except Exception as e:
            logger.warning(f"RPOWER Core API request failed: {e}")
            return {"error": str(e)}
    
    async def get_store_by_serial_number(self, serial_number: str, cg: str = None) -> dict:
        """
        Get store information from RPOWER Core API by serial number.
        serial_number: First 5 digits of Shepherd merchantId (or custom value)
        cg: Customer Group (required by API)
        Endpoint: /store/getbyserialnumber
        """
        url = f"{RPOWER_CORE_API_URL}/store/getbyserialnumber"
        params = {"Serial_Number": serial_number}
        if cg:
            params["CG"] = cg
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers, params=params)
                logger.info(f"RPOWER Core API response: {response.status_code} for SN={serial_number}, CG={cg}")
                
                # Check if we got HTML (login page) instead of JSON
                content_type = response.headers.get("content-type", "")
                if "text/html" in content_type:
                    logger.warning("RPOWER Core API returned HTML - likely auth redirect")
                    return {"error": "Authentication required"}
                
                # Handle non-200 responses
                if response.status_code != 200:
                    try:
                        error_data = response.json()
                        logger.warning(f"RPOWER Core API error response: {error_data}")
                        return {"error": str(error_data)}
                    except:
                        return {"error": f"API error: {response.status_code}"}
                
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.warning(f"RPOWER Core API error: {e.response.status_code}")
            return {"error": f"API error: {e.response.status_code}"}
        except Exception as e:
            logger.warning(f"RPOWER Core API request failed: {e}")
            return {"error": str(e)}

    async def get_store_tax_by_store(
        self,
        store_id: str = None,
        site_code: str = None,
        cg: str = None,
    ) -> dict:
        """
        Attempt to fetch store tax information from RPOWER Core API.
        Tries multiple endpoint/parameter combinations for compatibility.
        """
        attempts = [
            ("/store/getstoretaxbystore", {"Store_ID": store_id}),
            ("/store/getstoretaxbystore", {"StoreId": store_id}),
            ("/store/getstoretaxbystore", {"store_id": store_id}),
            ("/store/getstoretaxbystore", {"Site_Code": site_code}),
            ("/store/getstoretaxbystore", {"site_code": site_code}),
            ("/store/getstoretaxbystore", {"CG": cg}),
            ("/store/gettaxbystore", {"Store_ID": store_id}),
            ("/store/gettaxbystore", {"StoreId": store_id}),
            ("/store/gettaxbystore", {"store_id": store_id}),
            ("/store/gettaxbystore", {"Site_Code": site_code}),
            ("/store/gettaxbystore", {"site_code": site_code}),
            ("/store/gettaxbystore", {"CG": cg}),
        ]

        filtered_attempts = []
        for endpoint, params in attempts:
            clean_params = {k: v for k, v in params.items() if v not in (None, "")}
            if clean_params:
                filtered_attempts.append((endpoint, clean_params))

        if not filtered_attempts:
            return {"error": "Missing store identifier for tax lookup"}

        last_error = "No tax endpoint returned data"
        for endpoint, params in filtered_attempts:
            url = f"{RPOWER_CORE_API_URL}{endpoint}"
            try:
                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                    response = await client.get(url, headers=self.headers, params=params)
                    logger.info(
                        "RPOWER Core API tax lookup response: %s endpoint=%s params=%s",
                        response.status_code,
                        endpoint,
                        params,
                    )

                    content_type = response.headers.get("content-type", "")
                    if "text/html" in content_type:
                        last_error = "Authentication required"
                        continue

                    if response.status_code != 200:
                        last_error = f"API error: {response.status_code}"
                        continue

                    payload = response.json()
                    if payload:
                        return {
                            "endpoint": endpoint,
                            "params": params,
                            "payload": payload,
                        }
            except Exception as e:
                last_error = str(e)
                logger.warning(
                    "RPOWER Core tax lookup failed endpoint=%s params=%s error=%s",
                    endpoint,
                    params,
                    e,
                )

        return {"error": last_error}
    
    @staticmethod
    def extract_serial_from_merchant_id(shepherd_merchant_id: str) -> str:
        """
        Extract the serial number (first 5 digits) from Shepherd merchant ID.
        Example: "205500438" -> "20550"
        """
        if shepherd_merchant_id and len(shepherd_merchant_id) >= 5:
            return shepherd_merchant_id[:5]
        return shepherd_merchant_id or ""


# Singleton for Core API client
_rpower_core_client: Optional[RPowerCoreAPIClient] = None

def get_rpower_core_client() -> Optional[RPowerCoreAPIClient]:
    """Get or create the RPOWER Core API client singleton"""
    global _rpower_core_client
    if _rpower_core_client is None:
        _rpower_core_client = RPowerCoreAPIClient()
    return _rpower_core_client


class ShepherdAPIClient:
    """Client for interacting with the RPOWER Shepherd API"""
    
    def __init__(self, bearer_token: str):
        self.bearer_token = bearer_token
        self.headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
    
    async def _request(self, method: str, endpoint: str, data: Optional[dict] = None, base_url: str = None) -> Any:
        """Make an async HTTP request to the Shepherd API"""
        url = f"{base_url or SHEPHERD_BASE_URL}{endpoint}"
        started_at = datetime.now(timezone.utc).isoformat()
        start_time = time.perf_counter()
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=self.headers)
                elif method == "POST":
                    response = await client.post(url, headers=self.headers, json=data)
                elif method == "PUT":
                    response = await client.put(url, headers=self.headers, json=data)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")

                response_body = parse_httpx_response_body(response)
                append_shepherd_http_history({
                    "timestamp": started_at,
                    "url": url,
                    "method": method,
                    "status_code": response.status_code,
                    "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "request_body": data,
                    "response_body": response_body,
                    "content_type": response.headers.get("content-type"),
                })

                response.raise_for_status()
                return response_body
            except httpx.HTTPStatusError as e:
                response_body = parse_httpx_response_body(e.response)
                append_shepherd_http_history({
                    "timestamp": started_at,
                    "url": url,
                    "method": method,
                    "status_code": e.response.status_code,
                    "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "request_body": data,
                    "response_body": response_body,
                    "content_type": e.response.headers.get("content-type"),
                    "error": str(e),
                })
                logger.error(f"Shepherd API error: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                append_shepherd_http_history({
                    "timestamp": started_at,
                    "url": url,
                    "method": method,
                    "status_code": None,
                    "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "request_body": data,
                    "response_body": None,
                    "content_type": None,
                    "error": str(e),
                })
                logger.error(f"Shepherd API request failed: {str(e)}")
                raise
    
    async def get_merchants(self) -> List[dict]:
        """Get list of all merchants accessible with this token"""
        return await self._request("GET", "/merchants")
    
    async def get_merchant(self, merchant_id: str) -> dict:
        """Get details for a specific merchant"""
        return await self._request("GET", f"/merchants/{merchant_id}")
    
    async def get_menu(self, merchant_id: str) -> dict:
        """Get the full menu for a merchant from MENUUPDATE webhook event"""
        return await self._request("GET", f"/merchants/{merchant_id}/WebHooks/Events/MENUUPDATE")
    
    async def get_specific_menu(self, merchant_id: str, menu_id: str) -> dict:
        """Get a specific menu by ID"""
        return await self._request("GET", f"/merchants/{merchant_id}/menus/{menu_id}")
    
    async def get_schedules(self, merchant_id: str) -> dict:
        """Get menu schedules for a merchant"""
        return await self._request("GET", f"/merchants/{merchant_id}/schedules")
    
    async def get_tax_rates(self, merchant_id: str) -> dict:
        """Get tax rates for a merchant"""
        return await self._request("GET", f"/merchants/{merchant_id}/taxrates")
    
    async def get_menu_update_event(self, merchant_id: str) -> dict:
        """Get last menu update data from webhook events"""
        return await self._request("GET", f"/merchants/{merchant_id}/webhooks/events/menuupdate")
    
    async def get_orders(self, merchant_id: str) -> List[dict]:
        """Get orders for a merchant"""
        return await self._request("GET", f"/merchants/{merchant_id}/orders")
    
    async def submit_order(self, merchant_id: str, order_data: dict) -> dict:
        """Submit a new order to the merchant via Shepherd"""
        return await self._request("POST", f"/merchants/{merchant_id}/orders", order_data)
    
    async def get_order_status(self, merchant_id: str, order_ref: str) -> dict:
        """Get the status of a specific order"""
        return await self._request("GET", f"/merchants/{merchant_id}/orders/{order_ref}")
    
    async def get_hqding_info(self, merchant_id: str) -> dict:
        """
        Get comprehensive merchant site information from HQDingee.
        This includes license details, workstation info, site locations, and more.
        Endpoint: /merchants/{merchantId}/hqding
        """
        return await self._request("GET", f"/merchants/{merchant_id}/hqding")
    
    async def get_single_menu(self, merchant_id: str, menu_id: str) -> dict:
        """
        Get a single menu by its identifier.
        menuId is the part after the backtick in posId (e.g., "(ExportMenu)`Lunch" -> "Lunch")
        Endpoint: /merchants/{merchantId}/menus/{menuId}
        """
        return await self._request("GET", f"/merchants/{merchant_id}/menus/{menu_id}")
    
    @staticmethod
    def get_logo_url(merchant_id: str) -> str:
        """Generate the URL for a merchant's logo"""
        return f"{SHEPHERD_MEDIA_URL}/{merchant_id}/logo"
    
    @staticmethod
    def get_item_image_url(merchant_id: str, item_id: str) -> str:
        """Generate the URL for a menu item image"""
        return f"{SHEPHERD_MEDIA_URL}/{merchant_id}/item/{item_id}"


def transform_shepherd_menu_to_rnoo(shepherd_menu: dict, merchant_id: str, shepherd_merchant_id: str = None, rnoo_only: bool = True, schedules: list = None) -> dict:
    """
    Transform Shepherd menu format to RNOO format
    
    Shepherd structure:
    {
        "Menus": [
            {
                "MenuId": "RNOO_Main",
                "TaxRateId": "Tax1",
                "ScheduleId": "Lunch",  # Direct reference to schedule
                "Sections": [
                    {
                        "PosId": "...",
                        "Name": "Section Name",
                        "Items": [
                            {
                                "Mid": "unique_id",
                                "PosId": "POS_NAME",
                                "Name": "Display Name",
                                "Price": 1000,  # cents
                                "PLU": "12345",
                                "Description": "...",
                                "PosData": "key=value",
                                "ModPrompts": [{MinMods, MaxMods, Modifiers: [...]}]
                            }
                        ]
                    }
                ]
            }
        ]
    }
    
    RNOO structure:
    {
        "categories": [...],
        "items": [...]
    }
    
    Args:
        shepherd_menu: Raw menu data from Shepherd API
        merchant_id: Local RNOO merchant ID
        shepherd_merchant_id: Shepherd merchant ID (for generating image URLs)
        rnoo_only: If True, only import menus with MenuId starting with "RNOO"
        schedules: List of schedule objects from Shepherd for schedule matching
    """
    categories = {}  # Use dict to deduplicate by name
    items = []
    seen_item_ids = set()  # Track item IDs to avoid duplicates
    
    # Build schedule lookup by posId for direct matching
    schedule_lookup = {}
    if schedules:
        for s in schedules:
            pos_id = s.get("posId", "")
            if pos_id:
                schedule_lookup[pos_id] = s
            # Also index by name for fallback matching
            name = s.get("name", "")
            if name:
                schedule_lookup[name.lower().replace(" ", "")] = s
    
    menus = shepherd_menu.get("Menus", [])
    display_order = 0
    
    for menu in menus:
        menu_id = menu.get("MenuId", menu.get("PosId", ""))
        menu_name = menu.get("Name", "")
        menu_tax_rate_id = menu.get("TaxRateId")
        menu_schedule_id = menu.get("ScheduleId")  # Direct schedule reference
        
        # Filter for RNOO menus only if flag is set
        # Check if "RNOO" appears anywhere in the menu ID (case-insensitive)
        if rnoo_only and "RNOO" not in menu_id.upper():
            logger.info(f"Skipping menu '{menu_id}' - does not contain RNOO")
            continue
        
        logger.info(f"Processing RNOO menu: {menu_id} ({menu_name}) - Schedule: {menu_schedule_id}, Tax: {menu_tax_rate_id}")
        
        # Get schedule info - prefer direct ScheduleId, fallback to name matching
        schedule_info = None
        if menu_schedule_id and menu_schedule_id in schedule_lookup:
            schedule_info = schedule_lookup[menu_schedule_id]
            logger.info(f"  Matched schedule by ID: {menu_schedule_id}")
        elif schedules:
            # Fallback to name matching
            schedule_info = match_menu_to_schedule(menu_name, menu_id, schedules)
            if schedule_info:
                logger.info(f"  Matched schedule by name: {schedule_info.get('name')}")
        
        sections = menu.get("Sections", [])
        
        for section in sections:
            section_name = section.get("Name", section.get("PosId", "Unknown"))
            section_key = section_name.lower().replace(" ", "_")
            
            # Create or get category (dedup by name)
            if section_key not in categories:
                category = {
                    "id": f"{section_key}_{display_order}",
                    "merchant_id": merchant_id,
                    "name": section_name,
                    "description": section.get("Description", ""),
                    "display_order": display_order,
                    "is_active": True,
                    "shepherd_pos_id": section.get("PosId"),
                    "shepherd_menu_id": menu_id,
                    "tax_rate_id": menu_tax_rate_id,
                    # Schedule info from menu
                    "schedule_id": menu_schedule_id,
                    "schedule_name": schedule_info.get("name") if schedule_info else None,
                    "schedule_days": schedule_info.get("daysOfWeek") if schedule_info else None,
                    "schedule_start": schedule_info.get("start") if schedule_info else None,
                    "schedule_end": schedule_info.get("end") if schedule_info else None
                }
                categories[section_key] = category
                display_order += 1
            
            category_id = categories[section_key]["id"]
            
            # Process items in this section
            for item_data in section.get("Items", []):
                item_id = item_data.get("Mid", "")
                if item_id and item_id not in seen_item_ids:
                    item = transform_shepherd_item(item_data, merchant_id, category_id, shepherd_merchant_id, menu_tax_rate_id)
                    if item:
                        items.append(item)
                        seen_item_ids.add(item_id)
    
    return {
        "categories": list(categories.values()),
        "items": items
    }


def match_menu_to_schedule(menu_name: str, menu_id: str, schedules: list) -> Optional[dict]:
    """
    Try to match a menu name/ID to a schedule based on name similarity.
    
    Args:
        menu_name: The menu's display name (e.g., "Happy Hour")
        menu_id: The menu's ID (e.g., "(ExportMenu)`HappyHour")
        schedules: List of schedule objects from Shepherd
    
    Returns:
        Matching schedule dict or None
    """
    if not schedules:
        return None
    
    # Normalize menu identifiers
    menu_name_lower = menu_name.lower().replace(" ", "")
    menu_id_lower = menu_id.lower().replace(" ", "").replace("(exportmenu)", "").replace("`", "")
    
    for schedule in schedules:
        sched_name = schedule.get("name", "").lower().replace(" ", "")
        
        # Check for exact or partial match
        if sched_name and (
            sched_name in menu_name_lower or 
            sched_name in menu_id_lower or
            menu_name_lower in sched_name or
            menu_id_lower in sched_name
        ):
            return schedule
    
    return None


def transform_shepherd_item(item_data: dict, merchant_id: str, category_id: str, shepherd_merchant_id: str = None, menu_tax_rate_id: str = None) -> Optional[dict]:
    """
    Transform a single Shepherd menu item to RNOO format.
    
    Captures all Shepherd fields:
    - Mid: Main identifier
    - PosId: POS identifier
    - Name: Display name
    - Description: Item description
    - Price: Price in cents
    - PLU: PLU value
    - PosData: Custom key:value pairs
    - TaxRateId: Tax table
    - ModPrompts: [{MinMods, MaxMods, Modifiers: [...]}] for modifier enforcement
    """
    
    # Price is in cents, convert to dollars
    price_cents = item_data.get("Price", 0)
    price = price_cents / 100.0
    
    # Build modifier groups from ModPrompts with proper enforcement
    modifier_groups = []
    for mod_prompt in item_data.get("ModPrompts", []):
        min_mods = mod_prompt.get("MinMods", 0)
        max_mods = mod_prompt.get("MaxMods", 0)
        
        mod_group = {
            "id": mod_prompt.get("PosId", "").replace(" ", "_").replace("`", "").lower(),
            "name": mod_prompt.get("Name", mod_prompt.get("PosId", "")).split("`")[0],  # Clean name
            "min_selections": min_mods,
            "max_selections": max_mods if max_mods > 0 else 99,  # 0 means unlimited
            "is_required": min_mods > 0,
            "options": []
        }
        
        for modifier in mod_prompt.get("Modifiers", []):
            mod_price_cents = modifier.get("Price", 0)
            mod_name = modifier.get("Name", modifier.get("PosId", ""))
            # Clean modifier name (remove backtick extras)
            if "`" in mod_name:
                mod_name = mod_name.split("`")[0]
            
            # Check if this is a special prefix modifier (ends with ~)
            # These should allow multiple selections even in single-select groups
            is_prefix_modifier = mod_name.strip().endswith("~")
            
            option = {
                "id": modifier.get("Mid", ""),
                "name": mod_name,
                "plu": modifier.get("PLU") or "",
                "pos_id": modifier.get("PosId"),
                "shepherd_pos_id": modifier.get("PosId"),
                "price": mod_price_cents / 100.0,
                "is_default": False,
                "allow_duplicates": is_prefix_modifier,  # Special flag for ~ modifiers
                "shepherd_mid": modifier.get("Mid"),
                "tax_rate_id": modifier.get("TaxRateId"),
                "background_color": modifier.get("BackgroundColor"),
                "text_color": modifier.get("TextColor")
            }
            mod_group["options"].append(option)
        
        if mod_group["options"]:
            modifier_groups.append(mod_group)
    
    # Clean up item name (remove backtick truncations)
    name = item_data.get("Name", item_data.get("PosId", "Unknown"))
    if "`" in name:
        name = name.split("`")[0]
    
    # Generate image URL if we have shepherd merchant ID and item Mid
    image_url = None
    item_mid = item_data.get("Mid", "")
    if shepherd_merchant_id and item_mid:
        image_url = ShepherdAPIClient.get_item_image_url(shepherd_merchant_id, item_mid)
    
    return {
        "id": item_mid,
        "merchant_id": merchant_id,
        "category_id": category_id,
        "name": name,
        "description": item_data.get("Description", ""),
        "price": price,
        "image_url": image_url,
        "is_available": True,
        "modifier_groups": modifier_groups,
        # Shepherd-specific fields
        "shepherd_mid": item_mid,
        "plu": item_data.get("PLU") or "",
        "pos_id": item_data.get("PosId"),
        "pos_data": item_data.get("PosData"),
        "tax_rate_id": item_data.get("TaxRateId") or menu_tax_rate_id,
        "background_color": item_data.get("BackgroundColor")
    }


def build_shepherd_order(order: dict, merchant_shepherd_config: dict) -> dict:
    """
    Build a Shepherd-compatible order from RNOO order format
    
    API: POST https://remote.securerpower.com/posapi/merchants/{merchantId}/orders
    
    Key requirements:
    - ref: Required reference identifier
    - host: Required, default "POSCNX"
    - concept: Optional host concept
    - customer.n: Required customer name (lastName, firstName format)
    - customer.ctct.ph: Required phone number
    - tickets[].items[].p: Price format "$US10.50"
    - Special items: COMMENT, TAX, TIP with specific format
    """
    customer = order.get("customer", {})
    
    # Build address object
    addr = {}
    if customer.get("address_line1"):
        addr["l1"] = customer["address_line1"]
    if customer.get("address_line2"):
        addr["l2"] = customer["address_line2"]
    if customer.get("city"):
        addr["c"] = customer["city"]
    if customer.get("state"):
        addr["s"] = customer["state"]
    if customer.get("zip_code"):
        addr["z"] = customer["zip_code"]
    elif customer.get("zip"):
        addr["z"] = customer["zip"]

    if addr:
        addr["cc"] = "US"
    
    def normalize_payment_method(value: Any) -> str:
        """Normalize payment method values from strings/enums/documents."""
        if isinstance(value, dict):
            value = value.get("value") or value.get("method") or ""
        raw = str(value or "").strip().lower()
        if "." in raw:
            raw = raw.split(".")[-1]
        raw = raw.replace("-", "_").replace(" ", "_")
        return raw

    # Helper function to format price as "$US10.50" with half-up cent rounding
    def format_price(amount: float) -> str:
        rounded = Decimal(str(amount or 0)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        return f"$US{rounded:.2f}"
    
    # Build items with proper format
    items = []
    
    # Add order notes as COMMENT item if present
    if order.get("notes"):
        items.append({
            "pn": "COMMENT",
            "n": "COMMENT",
            "plu": "COMMENT",
            "qty": 1,
            "p": "$US0.00",
            "note": order["notes"],
            "mods": []
        })
    
    # Process menu items
    for item in order.get("items", []):
        order_item = {
            "pn": item.get("shepherd_pos_id") or item.get("pn") or item.get("plu") or "",
            "n": item.get("name", ""),
            "plu": item.get("plu") or "",
            "qty": item.get("quantity", 1),
            "p": format_price(item.get("unit_price", 0)),
            "mods": []
        }
        
        # Process modifiers
        for mod in item.get("modifiers", []):
            mod_item = {
                "n": mod.get("option_name", ""),
                "p": format_price(mod.get("price", 0))
            }
            if mod.get("plu"):
                mod_item["plu"] = mod["plu"]
            if mod.get("shepherd_pos_id") or mod.get("pn"):
                mod_item["pn"] = mod.get("shepherd_pos_id") or mod.get("pn")
            order_item["mods"].append(mod_item)
        
        # Add special instructions as item note
        if item.get("special_instructions"):
            order_item["note"] = item["special_instructions"]
        
        items.append(order_item)
    
    # Add TAX item
    tax_amount = order.get("tax", 0)
    if tax_amount > 0:
        items.append({
            "pn": "TAX",
            "plu": "TAX",
            "p": format_price(tax_amount),
            "mods": []
        })
    
    # Add TIP item if present
    tip_amount = order.get("tip", 0)
    if tip_amount > 0:
        items.append({
            "pn": "TIP",
            "plu": "TIP",
            "p": format_price(tip_amount),
            "mods": []
        })
    
    payment_method = (order.get("payment", {}) or {}).get("method", "")
    normalized_payment_method = normalize_payment_method(payment_method)
    include_payments = normalized_payment_method not in {
        "pay_at_store",
        "cash",
        "payinstore",
    }

    # Build payment info only for non pay-at-store orders
    payments = [{
        "pmid": "ONLINE",
        "pm": "Online Payment",
        "amt": format_price(order.get("total", 0))
    }] if include_payments else []
    
    # Map delivery type (RNOO uses DELIVERY, TAKEOUT, DINEIN)
    delivery_type = order.get("delivery_type", "TAKEOUT")
    if delivery_type == "DINEIN":
        delivery_type = "TAKEOUT"  # Map DINEIN to TAKEOUT for Shepherd
    
    # Build the ticket
    ticket = {
        "dlvt": delivery_type,
        "items": items,
    }

    if include_payments:
        ticket["payments"] = payments
    
    # Add need_dt (scheduled time) if not ASAP order
    if order.get("need_datetime"):
        ticket["need_dt"] = order["need_datetime"]
    
    # Build the complete shepherd order
    # Generate unique reference: RNOO-{order_number}-{timestamp}
    order_ref = f"RNOO-{order.get('order_number', 0)}-{order.get('id', '')[:8]}"
    
    shepherd_order = {
        "ref": order_ref,
        "host": "POSCNX",
        "concept": merchant_shepherd_config.get("concept_id") or "RNOO",
        "customer": {
            "n": customer.get("name", "Guest"),
            "ctct": {
                "ph": customer.get("phone", ""),
                "eml": customer.get("email", "")
            }
        },
        "tickets": [ticket]
    }
    
    # Add address if present
    if addr:
        shepherd_order["customer"]["addr"] = addr
    
    return shepherd_order


# Singleton client instance
_shepherd_client: Optional[ShepherdAPIClient] = None


def get_shepherd_client() -> Optional[ShepherdAPIClient]:
    """Get the singleton Shepherd client instance"""
    global _shepherd_client
    token = os.environ.get("SHEPHERD_BEARER_TOKEN")
    if token and not _shepherd_client:
        _shepherd_client = ShepherdAPIClient(token)
    return _shepherd_client


def init_shepherd_client(token: str) -> ShepherdAPIClient:
    """Initialize the Shepherd client with a token"""
    global _shepherd_client
    _shepherd_client = ShepherdAPIClient(token)
    return _shepherd_client
