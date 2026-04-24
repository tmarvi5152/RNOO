# Shepherd API Reference (Boarding + Sync)

Official docs:

- https://documenter.getpostman.com/view/38195259/2sAYJ7hzMd

## Purpose in RNOO

Use Shepherd API to:

- list merchants available for onboarding
- fetch merchant/license details for prefill
- sync menu/schedules/tax rates
- submit orders to POS pipeline

## Auth

- Bearer token loaded from backend `.env` as `SHEPHERD_BEARER_TOKEN`.

## Endpoints currently integrated in backend

1. `GET /api/shepherd/merchants`

- Returns available Shepherd merchants.
- Used by Admin > Merchants boarding flow.

2. `GET /api/shepherd/merchants/{shepherd_merchant_id}`

- Returns detailed Shepherd merchant payload.

3. `POST /api/shepherd/sync-menu/{merchant_id}`

- Syncs menu/schedules/tax rates into local DB for a boarded merchant.

4. `GET /api/merchants/{merchant_id}/shepherd-details`

- Detailed combined view for already-boarded merchant.

## Frontend usage points

- `frontend/src/pages/admin/MerchantsPage.js`
  - Lists Shepherd merchants
  - Selects merchant
  - Calls Shepherd merchant detail endpoint
  - Submits merchant create with linked `shepherd_config`

- `frontend/src/context/AppContext.js`
  - `getShepherdMerchants`
  - `getShepherdMerchant`

## Boarding flow summary (current)

1. Open Add Merchant dialog.
2. Optionally enter CG.
3. Select merchant from Shepherd list.
4. Frontend loads Shepherd merchant details and applies local fallback mapping.
5. Admin confirms/edit fields and submits create.
6. Merchant is created and linked via `shepherd_config.merchant_id`.
