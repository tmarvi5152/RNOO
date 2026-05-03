# How to Add a New Consumer Storefront Template

## Overview

Each template is a complete set of consumer-facing pages (menu, cart, checkout,
order tracking, order confirmation) that can be assigned per merchant in the
Admin → Merchant Detail page. The **classic** template is the baseline and
must never be modified when adding new templates.

---

## Step-by-Step

### 1. Create the template folder

```
frontend/src/templates/<template-name>/
  MenuPage.jsx
  CartPage.js
  CheckoutPage.jsx
  OrderTrackingPage.jsx
  OrderConfirmationPage.jsx
```

All five pages are required. They receive the same props and URL params as the
classic equivalents:

| Page                    | URL Params available | Notes                          |
| ----------------------- | -------------------- | ------------------------------ |
| `MenuPage`              | `:slug`              | Main storefront landing page   |
| `CartPage`              | `:slug`              | Cart review before checkout    |
| `CheckoutPage`          | `:slug`              | Payment + order submission     |
| `OrderTrackingPage`     | `:orderId`           | Real-time order status         |
| `OrderConfirmationPage` | query `?order_id=`   | Post-order confirmation screen |

You can reuse shared components from `src/components/consumer/` freely.
Layouts from `src/layouts/Layout.js` (e.g. `ConsumerLayout`) are also shared.

---

### 2. Register the template in `registry.js`

Open `frontend/src/templates/registry.js` and add an entry to `TEMPLATES`:

```js
import MenuPage    from "./<template-name>/MenuPage";
import CartPage    from "./<template-name>/CartPage";
import CheckoutPage from "./<template-name>/CheckoutPage";
import OrderTrackingPage from "./<template-name>/OrderTrackingPage";
import OrderConfirmationPage from "./<template-name>/OrderConfirmationPage";

export const TEMPLATES = {
  classic: { /* DO NOT TOUCH */ ... },

  "<template-name>": {
    label: "Human Readable Name",
    description: "One-line description shown in the admin dropdown",
    MenuPage,
    CartPage,
    CheckoutPage,
    OrderTrackingPage,
    OrderConfirmationPage,
  },
};
```

The key (e.g. `"modern"`) becomes the value stored in MongoDB and shown in
the admin dropdown. Keep it lowercase, no spaces.

---

### 3. That's it — no other files need changing

- `TemplateRouter.jsx` automatically picks up any key added to `TEMPLATES`
- `App.js` routes do not change
- The admin template dropdown auto-populates from `TEMPLATE_LIST`
- Existing merchants stay on `classic` unless manually changed in admin

---

## Protection of the Classic Template

The classic template pages live in `src/pages/consumer/` and are imported
directly into `registry.js`. They are **not copied or moved** — only referenced.

**Rules:**

- Never delete or rename files in `src/pages/consumer/`
- Never change the `classic` key in `TEMPLATES`
- New templates must live in their own subfolder under `src/templates/`
- New templates must not modify shared components — extend or clone them instead

---

## Suggested AI Prompt for Adding a New Template

Use this prompt when you're ready to build a new template:

---

> I want to add a new consumer storefront template called **"[NAME]"** to the RNOO frontend template system.
>
> **Design style:** [describe the visual style, e.g. "minimal, card-based layout" or "colorful, mobile-first, grid-style menu"]
>
> **Differences from classic:** [describe what should be different, e.g. "show featured items hero at top, hide category sidebar, use bottom sheet cart instead of floating cart"]
>
> **Pages to build:** All five — MenuPage, CartPage, CheckoutPage, OrderTrackingPage, OrderConfirmationPage.
>
> **Reuse from classic:** [list what to keep the same, e.g. "same cart logic and checkout flow, only the visual layout changes"]
>
> Please:
>
> 1. Create all pages in `frontend/src/templates/[name]/`
> 2. Register the template in `frontend/src/templates/registry.js` using key `"[name]"` with label `"[Label]"` and description `"[one-liner]"`
> 3. Do NOT modify `src/pages/consumer/` or the `classic` entry in the registry
> 4. Lint check after completion

---

## Current Templates

| Key       | Label   | Description                           | Status    |
| --------- | ------- | ------------------------------------- | --------- |
| `classic` | Classic | The original RNOO consumer experience | ✅ Active |
