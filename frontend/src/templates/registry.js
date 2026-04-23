/**
 * Template Registry
 * Maps template names to their page components.
 * Add new templates here as additional objects in TEMPLATES.
 */
import FuturisticMenuPage from "../pages/consumer/FuturisticMenuPage";
import CartPage from "../pages/consumer/CartPage";
import CheckoutPage from "../pages/consumer/CheckoutPage";
import OrderTrackingPage from "../pages/consumer/OrderTrackingPage";
import OrderConfirmationPage from "../pages/consumer/OrderConfirmationPage";

export const DEFAULT_TEMPLATE = "classic";

export const TEMPLATES = {
  classic: {
    label: "Classic",
    description: "The original RNOO consumer experience",
    MenuPage: FuturisticMenuPage,
    CartPage: CartPage,
    CheckoutPage: CheckoutPage,
    OrderTrackingPage: OrderTrackingPage,
    OrderConfirmationPage: OrderConfirmationPage,
  },
  // Future templates go here, e.g.:
  // modern: { label: "Modern", MenuPage: ..., ... }
};

/** Ordered list used for admin UI dropdowns */
export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(
  ([value, { label, description }]) => ({ value, label, description }),
);
