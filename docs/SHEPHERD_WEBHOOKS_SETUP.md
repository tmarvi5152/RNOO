# Shepherd Webhook Integration — Activation Guide

This guide is for when RNOO is deployed on a real public domain and you want to enable Shepherd push webhooks instead of relying solely on the 60-second poll loop.

---

## How It Works

Shepherd supports push webhooks — instead of RNOO asking Shepherd "any updates?" every 60 seconds, Shepherd will POST to your server instantly when an order status changes, the menu updates, or a new order comes in.

RNOO will automatically subscribe all active merchants on startup once you provide the public URL.

---

## Step 1 — Add the Environment Variable

In your `.env` file (in the `backend/` folder), add:

```env
WEBHOOK_BASE_URL=https://yourdomain.com
```

Do **not** include a trailing slash. Use `https://` — Shepherd requires a publicly reachable HTTPS URL.

Example:

```env
WEBHOOK_BASE_URL=https://orders.myrestaurant.com
```

---

## Step 2 — Expose the Webhook Receiver Endpoint

Shepherd will POST events to:

```
POST https://yourdomain.com/api/webhooks/shepherd/{shepherd_merchant_id}
```

This endpoint is already built and registered. You do not need to do anything in the code — just make sure your reverse proxy (nginx, Caddy, etc.) forwards requests to the FastAPI backend as normal.

### Nginx example (if using a subdirectory path):

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Step 3 — (Optional) Restrict Webhook Path by IP

Shepherd's webhook POSTs will come from RPOWER/Shepherd servers. For production security, you can whitelist those IPs at the nginx level:

```nginx
location /api/webhooks/ {
    allow <shepherd-server-ip>;
    deny all;
    proxy_pass http://127.0.0.1:8000;
}
```

Contact RPOWER support to get the IP range Shepherd sends webhooks from.

---

## Step 4 — Restart the Backend

After updating `.env`, restart the backend:

```bash
# If using the PowerShell start script:
.\start-backend.ps1

# Or directly:
cd backend
python run.py
```

On startup you will see log lines like:

```
Shepherd webhook subscription task started (base URL: https://yourdomain.com)
Webhook startup: subscribed <merchant_id> to ORDERSTATUSUPDATE -> https://yourdomain.com/api/webhooks/shepherd/<merchant_id>
Webhook startup: subscribed <merchant_id> to MENUUPDATE -> ...
Webhook startup: subscribed <merchant_id> to NEWORDER -> ...
```

If `WEBHOOK_BASE_URL` is **not** set, the server still works in poll-only mode:

```
WEBHOOK_BASE_URL not set — running in poll-only mode
```

---

## Events Subscribed Automatically

| Event               | What triggers it                          | What RNOO does                                              |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `ORDERSTATUSUPDATE` | Order status changes in the POS           | Updates order in DB + broadcasts via WebSocket in real time |
| `MENUUPDATE`        | Menu is changed in the POS                | Re-syncs full menu from Shepherd automatically              |
| `NEWORDER`          | New order received at POS (informational) | Logged only                                                 |

---

## Admin Endpoints (for manual management)

These require a `SUPER_ADMIN` or `RESELLER` JWT token.

| Method   | Path                                                                         | Description                   |
| -------- | ---------------------------------------------------------------------------- | ----------------------------- |
| `GET`    | `/api/shepherd/merchants/{id}/webhooks/events`                               | List available event types    |
| `GET`    | `/api/shepherd/merchants/{id}/webhooks/subscriptions`                        | List active subscriptions     |
| `POST`   | `/api/shepherd/merchants/{id}/webhooks/subscribe?event_id=ORDERSTATUSUPDATE` | Subscribe to a specific event |
| `DELETE` | `/api/shepherd/merchants/{id}/webhooks/ORDERSTATUSUPDATE`                    | Unsubscribe from an event     |

---

## Background Poll Fallback

The 60-second poll loop (`sync_order_statuses_background`) continues to run even when webhooks are active. This acts as a safety net for any events that may have been missed. Once you are confident webhooks are working reliably, you can increase the poll interval by setting:

```env
ORDER_STATUS_SYNC_INTERVAL=300
```

This reduces it to polling every 5 minutes instead of every 60 seconds, keeping it as a fallback without the overhead.

---

## Local Development (Temporary Testing)

If you want to test webhooks locally before going live, you can use [ngrok](https://ngrok.com) to expose your local backend:

```bash
ngrok http 8000
```

Then set `WEBHOOK_BASE_URL` to the ngrok HTTPS URL it gives you:

```env
WEBHOOK_BASE_URL=https://abc123.ngrok.io
```

Restart the backend and Shepherd will be able to POST to your local machine. Note: ngrok URLs change every session unless you have a paid account with a fixed subdomain.
