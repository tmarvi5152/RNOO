# RNOO Project Handover Guide (RPOWER Publish)

This document is the implementation handoff for developers who will run, verify, and publish this project.

## 1. Project Summary

RNOO is a full-stack online ordering platform with:

- FastAPI backend
- React frontend (CRACO + Tailwind + Radix UI)
- MongoDB database
- WebSocket order updates
- Shepherd/RPOWER integration paths

Main template used for this handoff work:

- `frontend/src/templates/rpower-original/`

## 2. Tech Stack

### Backend

- Python 3.x (virtualenv recommended)
- FastAPI
- Uvicorn / Gunicorn (Procfile included)
- Motor + PyMongo (MongoDB async access)
- JWT auth (`python-jose` + `PyJWT`)
- WebSocket support (native FastAPI/Starlette websockets)

Primary backend files:

- `backend/server.py` (API + websocket + business logic)
- `backend/run.py` (local server entrypoint)
- `backend/requirements.txt`
- `backend/Procfile`

### Frontend

- React 18
- CRACO (instead of default react-scripts start)
- Tailwind CSS
- Radix UI components
- Framer Motion
- Zustand state management
- Axios API client

Primary frontend files:

- `frontend/package.json`
- `frontend/src/context/AppContext.js`
- `frontend/src/hooks/useOrderWebSocket.js`
- `frontend/src/templates/rpower-original/*`

### Database

- MongoDB
- Default connection (if not configured): `mongodb://127.0.0.1:27017`
- Default DB name (if not configured): `rnoo`

## 3. High-Level Architecture

### Request flow

1. Frontend calls backend REST APIs under `/api/*`.
2. Backend reads/writes MongoDB collections.
3. Frontend tracks order changes via WebSocket endpoint:
   - `/api/ws/orders/{merchant_id}`
4. Shepherd/RPOWER webhook events are received by backend and can update order states.

### Key functional areas

- Auth/login/register (`/api/auth/*`)
- Merchant/menu/category/menu-items
- Cart/checkout/order creation
- Public order tracking (`/api/orders/public/{order_id}`)
- WebSocket push updates for order changes
- Shepherd webhook endpoint (`/api/webhooks/shepherd/{shepherd_merchant_id}`)

## 4. Environment Variables

### Backend (`backend/.env`)

- `MONGO_URL` (default: `mongodb://127.0.0.1:27017`)
- `DB_NAME` (default: `rnoo`)
- `JWT_SECRET` (set in production)
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `8765`)
- `LOG_LEVEL` (default: `info`)
- `RELOAD` (`true/false`, default false)
- `CORS_ORIGINS` (default `*`)
- `SHEPHERD_BEARER_TOKEN` (required for Shepherd sync/webhook subscriptions)
- `WEBHOOK_BASE_URL` (required for webhook callback URL generation)
- `ORDER_STATUS_SYNC_INTERVAL` (seconds, default 60)

### Frontend (`frontend/.env`)

- `REACT_APP_BACKEND_URL` (default fallback in code: `http://localhost:8765`)
- `REACT_APP_DEFAULT_TAX_RATE` (optional)
- `REACT_APP_API_URL` (used by one template path; optional depending on template)

## 5. Local Setup (Fresh Clone)

## 5.1 Prerequisites

- Git
- Python 3.x
- Node + Yarn Classic (`1.22.x`)
- MongoDB running locally

## 5.2 Clone + install

From repo root:

```powershell
git clone <repo-url>
cd RNOO
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\backend\requirements.txt
cd .\frontend
yarn install
cd ..
```

## 5.3 Start services

Option A (recommended local helper):

- Run `START_APP.bat`

Option B (manual split terminals):

Terminal 1:

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
python run.py
```

Terminal 2:

```powershell
cd frontend
yarn start
```

Expected local URLs:

- Backend: `http://127.0.0.1:8765`
- Frontend: `http://localhost:3456`

## 6. Initial Database Bootstrap (So Devs Can Login Immediately)

This project includes a built-in development seed endpoint:

- `POST /api/seed`

It creates:

- Super admin user
- Reseller user
- Merchant user
- Demo merchant + categories + menu items

### Seed command (PowerShell)

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8765/api/seed"
```

If already seeded, response returns:

- `Database already seeded`

### Seeded credentials

- Super Admin: `admin@rpower.com` / `admin123`
- Reseller: `reseller@demo.com` / `reseller123`
- Merchant: `merchant@demo.com` / `merchant123`

Demo merchant slug:

- `demo-burger-joint`

### Important for production

- Do NOT expose `/api/seed` in production.
- Restrict/remove this route before publish, or gate it behind an environment flag + admin auth.

## 7. Collections Used (Primary)

Common MongoDB collections used by backend logic:

- `users`
- `resellers`
- `merchants`
- `menu_categories`
- `menu_items`
- `orders`
- `audit_logs`

## 8. How Order Updates Work

1. Frontend tracking page opens websocket to `/api/ws/orders/{merchant_id}`.
2. Backend accepts connection and keeps merchant-specific connection list.
3. Backend broadcasts order events when statuses change.
4. Frontend also polls `/api/orders/public/{order_id}` every 10s as a fallback.

Recent stabilization note:

- `frontend/src/hooks/useOrderWebSocket.js` was adjusted to avoid unnecessary reconnect churn from callback re-renders.

## 9. RPOWER/Shepherd Integration Notes

- Shepherd API token read from `SHEPHERD_BEARER_TOKEN`.
- Webhook callback URL uses `WEBHOOK_BASE_URL`.
- Startup may auto-subscribe webhook events for active linked merchants.
- Relevant docs:
  - `docs/SHEPHERD_API.md`
  - `docs/SHEPHERD_WEBHOOKS_SETUP.md`
  - `docs/CORE_API.md`

## 10. Frontend Template Notes (RPOWER Original)

Main files:

- `frontend/src/templates/rpower-original/MenuPage.jsx`
- `frontend/src/templates/rpower-original/HeroBanner.jsx`
- `frontend/src/templates/rpower-original/RpowerOriginalTheme.jsx`
- `frontend/src/templates/rpower-original/CartPage.jsx`
- `frontend/src/templates/rpower-original/CheckoutPage.jsx`
- `frontend/src/templates/rpower-original/OrderTrackingPage.jsx`
- `frontend/src/templates/rpower-original/OrderConfirmationPage.jsx`

Assets used:

- `frontend/src/images/RPOWER_Background.jpg`
- `frontend/src/images/RPOWER_HeroBanner.png`
- `frontend/src/images/Rpower_Buttons.png`
- `frontend/src/images/rpower-logo.png`

## 11. Publish/Deployment Checklist

1. Set production environment variables (backend + frontend).
2. Point frontend `REACT_APP_BACKEND_URL` to production API URL.
3. Ensure MongoDB production instance is reachable and secured.
4. Rotate JWT secret and API tokens.
5. Disable or protect `/api/seed` endpoint before release.
6. Set `CORS_ORIGINS` to explicit domains (no wildcard in production).
7. Validate webhook callback URL (`WEBHOOK_BASE_URL`) is public + HTTPS.
8. Build frontend:

```powershell
cd frontend
yarn build
```

9. Backend process command (example from Procfile):

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker server:app
```

10. Run smoke tests:

- Login works
- Merchant menu loads
- Cart + checkout works
- Public tracking updates
- WebSocket updates observed


