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
import VantageMenuPage from "./vantage/MenuPage";
import VantageCartPage from "./vantage/CartPage";
import VantageCheckoutPage from "./vantage/CheckoutPage";
import VantageOrderTrackingPage from "./vantage/OrderTrackingPage";
import VantageOrderConfirmationPage from "./vantage/OrderConfirmationPage";
import RpowerJimBaldridgeMenuPage from "./rpower-jim-baldridge/MenuPage";
import RpowerJimBaldridgeCartPage from "./rpower-jim-baldridge/CartPage";
import RpowerJimBaldridgeCheckoutPage from "./rpower-jim-baldridge/CheckoutPage";
import RpowerJimBaldridgeOrderTrackingPage from "./rpower-jim-baldridge/OrderTrackingPage";
import RpowerJimBaldridgeOrderConfirmationPage from "./rpower-jim-baldridge/OrderConfirmationPage";

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
  vantage: {
    label: "Vantage",
    description:
      "A premium, image-forward layout featuring immersive category headers and a refined minimalist checkout flow.",
    MenuPage: VantageMenuPage,
    CartPage: VantageCartPage,
    CheckoutPage: VantageCheckoutPage,
    OrderTrackingPage: VantageOrderTrackingPage,
    OrderConfirmationPage: VantageOrderConfirmationPage,
  },
  rpower_jim_baldridge: {
    label: "RPOWER Jim Baldridge Version",
    description:
      "A legacy tribute theme inspired by RPOWER heritage with a premium dark presentation and memorial tone.",
    MenuPage: RpowerJimBaldridgeMenuPage,
    CartPage: RpowerJimBaldridgeCartPage,
    CheckoutPage: RpowerJimBaldridgeCheckoutPage,
    OrderTrackingPage: RpowerJimBaldridgeOrderTrackingPage,
    OrderConfirmationPage: RpowerJimBaldridgeOrderConfirmationPage,
  },
  // Future templates go here, e.g.:
  // modern: { label: "Modern", MenuPage: ..., ... }
};

/** Ordered list used for admin UI dropdowns */
export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(
  ([value, { label, description }]) => ({ value, label, description }),
);
