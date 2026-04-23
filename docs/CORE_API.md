# RPOWER Core API Reference (Boarding)

Official docs:

- https://documenter.getpostman.com/view/38195259/2sAYJ7hzHN

## Purpose in RNOO

Use Core API to enrich merchant boarding data (store name, address, city, state, zip, phone, URL), preferably from `guest_checks`.

## Auth

- Uses same bearer token configured in backend as `SHEPHERD_BEARER_TOKEN`.

## Endpoints currently integrated

1. `GET /store/getbycg`

- Method in code: `RPowerCoreAPIClient.get_store_by_cg(cg, sort_order, page_number)`
- Current use:
  - Existing merchant details page (`/merchants/{id}/shepherd-details`) when `shepherd_config.rpower_cg` is set.
  - New boarding profile endpoint (`/shepherd/merchants/{id}/boarding-profile?cg=...`).

2. `GET /store/getbyserialnumber`

- Method in code: `RPowerCoreAPIClient.get_store_by_serial_number(serial_number, cg=None)`
- Current use:
  - New boarding profile endpoint as fallback when CG is not provided.

## Data mapping used during boarding

Preferred source order for onboarding profile:

1. Core API guest_checks (if available)
2. Shepherd license fields

Mapped fields:

- `name`
- `address_line1`
- `address_line2`
- `city`
- `state`
- `zip_code`
- `phone`
- `url`
- `email` (from Shepherd when Core does not provide)

## Backend code references

- `backend/shepherd_client.py`
  - `RPowerCoreAPIClient.get_store_by_cg`
  - `RPowerCoreAPIClient.get_store_by_serial_number`
- `backend/server.py`
  - `GET /shepherd/merchants/{shepherd_merchant_id}/boarding-profile`
  - `GET /merchants/{merchant_id}/shepherd-details`
