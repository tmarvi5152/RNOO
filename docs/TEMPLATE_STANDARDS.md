# RNOO Template Standards

This document captures the parity requirements, behavioral contracts, and implementation checklist for all consumer-facing templates. Follow every section when building a new template. These standards were derived from a full cross-template audit (Phases 1–7) performed on the five existing templates: **classic, vantage, velocity, crave, rpower_jim_baldridge**.

---

## Template Structure

Every template must export exactly **five page components** and be registered in `frontend/src/templates/registry.js`:

```js
// frontend/src/templates/registry.js
import MyTemplateMenuPage from "./my-template/MenuPage";
// … other page imports

export const TEMPLATES = {
  my_template: {
    label: "My Template",
    description: "One sentence describing the visual style.",
    MenuPage: MyTemplateMenuPage,
    CartPage: MyTemplateCartPage,
    CheckoutPage: MyTemplateCheckoutPage,
    OrderTrackingPage: MyTemplateOrderTrackingPage,
    OrderConfirmationPage: MyTemplateOrderConfirmationPage,
  },
};
```

All five pages are **required**. A template with any missing page will break routing.

---

## 1. MenuPage — Product Browsing & Modifier Flow

### Required behaviors

- Display categorized product list/grid with names, prices, and images.
- Opening a product opens a **modal, bottom sheet, or drawer** (not a page navigation).

### Modifier UX (critical)

- Required modifier groups must validate **inline** — not toast-only.
  - When the user tries to add to cart without satisfying a required group, highlight that group visually (red border / background) and show a message like "Choose at least 1" or "Please make a selection" directly inside the group.
  - Set a local `attempted` state on the Add button press and clear it on success.
- Quantity steppers (`−` / `+`) must be **≥ 40 px** touch targets.
- All stepper buttons must have `aria-label` attributes, e.g.:
  ```jsx
  <button aria-label="Decrease quantity">−</button>
  <button aria-label="Increase quantity">+</button>
  ```

---

## 2. CartPage — Cart Review & Summary

### Required behaviors

- Show line items with name, modifiers summary, quantity, and `item.totalPrice`.
- Totals sourced exclusively from the canonical Zustand store helpers:
  ```js
  import useCartStore from "../../stores/cartStore";
  const { getSubtotal, getTax, getTotal } = useCartStore();
  ```
  Never recompute totals locally.

### Summary display

- **Tax label** must read exactly: `Tax`.
- Show rows: Subtotal → Tax → Tip (if applicable) → **Total**.
- Do not hardcode delivery fee amounts in any template view. If a delivery fee is provided by backend/Shepherd totals, render that backend-provided value.

### Mobile sticky summary (required)

- On mobile (`lg:hidden`), a **sticky footer bar** must be visible at the bottom of the screen showing the Total and a prominent "Proceed to Checkout" (or equivalent) CTA button.
- Add `pb-28 lg:pb-0` (or equivalent) bottom padding to the scrollable content area to prevent the sticky bar from obscuring items.

Example structure:

```jsx
{
  /* Mobile sticky summary */
}
<div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t p-4 lg:hidden">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-xs text-zinc-400">Total</p>
      <p className="text-lg font-bold">${total.toFixed(2)}</p>
    </div>
    <button onClick={() => navigate("/checkout")}>Proceed to Checkout</button>
  </div>
</div>;
```

---

## 3. CheckoutPage — Order Form & Payment

### Payment options (all five required)

Every CheckoutPage must present all five payment options:

| Value          | Display label                |
| -------------- | ---------------------------- |
| `demo_card`    | Credit / Debit Card _(demo)_ |
| `cash`         | Cash                         |
| `pay_at_store` | Pay at Store                 |
| `apple_pay`    | Apple Pay                    |
| `google_pay`   | Google Pay                   |

Apple Pay and Google Pay must render as distinct buttons styled as "express checkout" options, visually separated from the standard radio group with an "or" divider.

### Mobile form accessibility (required)

- All `<input>` and `<select>` fields must be **≥ 48 px tall** (`h-12` minimum).
- All form text must use at least `text-sm` with `md:text-base` scaling.
- Delivery address fields (street, city, state, ZIP) must stack vertically on mobile and may go side-by-side on desktop (`md:grid-cols-2`).

### Validation (unified messaging)

Use this exact wording for all validation toasts or inline errors:

| Condition                   | Message                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| Name empty                  | `"Please enter your full name"`                                        |
| Phone empty                 | `"Please enter your phone number"`                                     |
| Delivery address incomplete | `"Please complete delivery address (street, city, ZIP)"`               |
| Scheduled time not chosen   | `"Please select both a date and time"`                                 |
| No payment method           | `"Please select a payment method"`                                     |
| Cart empty                  | `"Your cart is empty"`                                                 |
| Missing merchant context    | `"Merchant context is missing. Please reopen the menu and try again."` |

Validate name and phone **separately** so the user knows exactly which field is missing.

### Multi-step checkout (if using steps)

- Use descriptive step names that match the action: **"Your Info"**, **"Payment"**, **"Review"**.
- Do not use vague labels like "Confirm" for the final review step.

### Submit button (loading state)

- Loading text: `Placing Order...` (with spinner icon)
- Default text: `Place Order • $XX.XX` (include the total in the button)
- Exception: templates with a different primary CTA concept (e.g., RJB "Submit Ticket") may use their own label but must still append `• $XX.XX`.

Example:

```jsx
<button disabled={submitting}>
  {submitting ? (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Placing Order...
    </span>
  ) : (
    `Place Order • $${total.toFixed(2)}`
  )}
</button>
```

---

## 4. OrderTrackingPage — Live Order Status

### Tracking steps (required four-step display)

All templates must use this four-step model (collapsing `pending` + `confirmed` into a single "Received" step):

```js
const DISPLAY_STEPS = [
  { label: "Received", statuses: ["pending", "confirmed"] },
  { label: "Preparing", statuses: ["preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Delivered", statuses: ["delivered"] },
];
```

### Real-time updates

- Use `useOrderWebSocket` and **destructure** the `isConnected` return value:
  ```js
  const { isConnected } = useOrderWebSocket({ merchantId, onOrderUpdate });
  ```
- When `isConnected` is true, show a **Live badge** in the UI (animated pulse dot preferred).
- Auto-poll every 10 seconds as a fallback:
  ```js
  useEffect(() => {
    const id = setInterval(() => loadOrder(true), 10000);
    return () => clearInterval(id);
  }, [loadOrder]);
  ```

### Loading state

- Use a **spinner**, not plain text. Match the spinner color to the template accent color:
  ```jsx
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }
  ```

### Error / not found state

- Show a centered error state with an icon, a message, and a "Back Home" button.
- Button must navigate to `"/"`.

### Refresh button

- Provide a manual refresh button with `aria-label="Refresh order status"`.

---

## 5. OrderConfirmationPage — Post-Order Receipt

### Required content

Every confirmation page must display all of the following:

1. **Success icon** (animated entry preferred)
2. **Order ID** — full ID, copyable on click/tap with visual feedback
3. **Payment method** — human-readable label (see table below)
4. **Track Order** CTA button — navigates to `/track/${orderId}`
5. **Back to Menu** CTA — navigates to `/order/${merchantSlug}` (or `/` if no slug)

### Payment method label map (all five required)

Every `OrderConfirmationPage` must include all five entries:

```js
const paymentMethodLabelMap = {
  demo_card: "Demo Credit Card",
  cash: "Cash",
  pay_at_store: "Pay at Store",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};
const paymentMethodLabel = paymentMethodLabelMap[paymentMethod] || "";
```

**Do not** omit `apple_pay` and `google_pay` — this causes a silent blank label when a user checked out with express pay.

### Reading query params

The confirmation page receives data via URL search params:

```
/order-confirmation?orderId=...&merchantSlug=...&paymentMethod=...
```

Always read all three:

```js
const [searchParams] = useSearchParams();
const orderId = searchParams.get("orderId") || "";
const merchantSlug = searchParams.get("merchantSlug") || "";
const paymentMethod = searchParams.get("paymentMethod") || "";
```

### Missing orderId guard

If `orderId` is empty, render a fallback state (not null/blank) and provide a "Back Home" button navigating to `"/"`.

---

## 6. Theme Injection Pattern

When a template needs custom CSS variables, use the **idempotent inject-once** pattern:

```js
function useMyTemplateTheme() {
  useEffect(() => {
    const id = "my-template-theme";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        :root {
          --my-accent: #ff4405;
        }
      `;
      document.head.appendChild(el);
    }
  }, []);
}
```

Call the hook at the top of each page component. This is safe to call in multiple components — the `getElementById` guard prevents duplicate injection.

---

## 7. Checklist for New Templates

Use this checklist before shipping a new template:

### MenuPage

- [ ] Products grouped by category
- [ ] Product modal/sheet/drawer opens on card click
- [ ] Required modifier groups show inline validation error (not toast-only)
- [ ] Quantity steppers ≥ 40 px with `aria-label` on both buttons

### CartPage

- [ ] Totals from `useCartStore` helpers only (`getSubtotal`, `getTax`, `getTotal`)
- [ ] Tax row reads "Tax"
- [ ] Mobile sticky footer with total + checkout CTA (`lg:hidden`)
- [ ] Bottom padding prevents sticky bar overlap (`pb-28 lg:pb-0`)

### CheckoutPage

- [ ] All 5 payment methods present (demo_card, cash, pay_at_store, apple_pay, google_pay)
- [ ] Apple Pay + Google Pay visually separated as express options
- [ ] All inputs/selects ≥ h-12 (48 px)
- [ ] Form text `text-sm md:text-base`
- [ ] Validation messages match the standard wording table
- [ ] Submit button shows total in default state
- [ ] Submit button shows "Placing Order..." + spinner in loading state
- [ ] Step labels use "Your Info" / "Payment" / "Review" (not "Confirm")

### OrderTrackingPage

- [ ] Four-step tracker: Received → Preparing → Ready → Delivered
- [ ] `const { isConnected } = useOrderWebSocket(...)` (not ignored)
- [ ] Live badge shown when `isConnected` is true
- [ ] Auto-poll `setInterval` every 10 000 ms with cleanup
- [ ] Loading state is a spinner (not plain text)
- [ ] Error state has icon + "Back Home" button
- [ ] Refresh button has `aria-label="Refresh order status"`

### OrderConfirmationPage

- [ ] Success icon with animation
- [ ] Order ID copyable with visual feedback (toast or inline "Copied")
- [ ] `paymentMethodLabelMap` includes all 5 methods (including apple_pay, google_pay)
- [ ] Payment method label rendered in UI
- [ ] Track Order CTA → `/track/${orderId}`
- [ ] Back to Menu CTA → `/order/${merchantSlug}` (or `/`)
- [ ] Missing orderId renders a fallback with "Back Home" button

---

## 8. Existing Templates Reference

| Template key           | Folder                            | Style                     | Accent color |
| ---------------------- | --------------------------------- | ------------------------- | ------------ |
| `classic`              | `pages/consumer/`                 | Dark futuristic, orange   | `#f97316`    |
| `vantage`              | `templates/vantage/`              | Light minimalist, black   | `#000000`    |
| `velocity`             | `templates/velocity/`             | Light speed, orange-red   | `#ff4405`    |
| `crave`                | `templates/crave/`                | Light modern, red         | `#ef4444`    |
| `rpower_jim_baldridge` | `templates/rpower-jim-baldridge/` | Dark legacy tribute, gold | `#f6c453`    |

See [`HOW_TO_ADD_TEMPLATE.md`](../frontend/src/templates/HOW_TO_ADD_TEMPLATE.md) for the scaffolding process, then use this document to verify compliance before merging.
