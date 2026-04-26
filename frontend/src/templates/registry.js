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
import VelocityMenuPage from "./velocity/MenuPage";
import VelocityCartPage from "./velocity/CartPage";
import VelocityCheckoutPage from "./velocity/CheckoutPage";
import VelocityOrderTrackingPage from "./velocity/OrderTrackingPage";
import VelocityOrderConfirmationPage from "./velocity/OrderConfirmationPage";
import CraveMenuPage from "./crave/MenuPage";
import CraveCartPage from "./crave/CartPage";
import CraveCheckoutPage from "./crave/CheckoutPage";
import CraveOrderTrackingPage from "./crave/OrderTrackingPage";
import CraveOrderConfirmationPage from "./crave/OrderConfirmationPage";
import RpowerOriginalMenuPage from "./rpower-original/MenuPage";
import RpowerOriginalCartPage from "./rpower-original/CartPage";
import RpowerOriginalCheckoutPage from "./rpower-original/CheckoutPage";
import RpowerOriginalOrderTrackingPage from "./rpower-original/OrderTrackingPage";
import RpowerOriginalOrderConfirmationPage from "./rpower-original/OrderConfirmationPage";

export const DEFAULT_TEMPLATE = "classic";

export const TEMPLATES = {
  classic: {
    label: "Template # 1",
    description: "Classic",
    MenuPage: FuturisticMenuPage,
    CartPage: CartPage,
    CheckoutPage: CheckoutPage,
    OrderTrackingPage: OrderTrackingPage,
    OrderConfirmationPage: OrderConfirmationPage,
  },
  vantage: {
    label: "Template # 2",
    description:
      "Vantage",
    MenuPage: VantageMenuPage,
    CartPage: VantageCartPage,
    CheckoutPage: VantageCheckoutPage,
    OrderTrackingPage: VantageOrderTrackingPage,
    OrderConfirmationPage: VantageOrderConfirmationPage,
  },
  rpower_jim_baldridge: {
    label: "Template # 3",
    description:
      "Jim Baldridge - Version",
    MenuPage: RpowerJimBaldridgeMenuPage,
    CartPage: RpowerJimBaldridgeCartPage,
    CheckoutPage: RpowerJimBaldridgeCheckoutPage,
    OrderTrackingPage: RpowerJimBaldridgeOrderTrackingPage,
    OrderConfirmationPage: RpowerJimBaldridgeOrderConfirmationPage,
  },
  velocity: {
    label: "Template # 4",
    description:
      "Velocity",
    MenuPage: VelocityMenuPage,
    CartPage: VelocityCartPage,
    CheckoutPage: VelocityCheckoutPage,
    OrderTrackingPage: VelocityOrderTrackingPage,
    OrderConfirmationPage: VelocityOrderConfirmationPage,
  },
  crave: {
    label: "Template # 5",
    description:
      "Cravings",
    MenuPage: CraveMenuPage,
    CartPage: CraveCartPage,
    CheckoutPage: CraveCheckoutPage,
    OrderTrackingPage: CraveOrderTrackingPage,
    OrderConfirmationPage: CraveOrderConfirmationPage,
  },
  rpower_original: {
    label: "Template # 6",
    description:
      "RPOWER - Original",
    MenuPage: RpowerOriginalMenuPage,
    CartPage: RpowerOriginalCartPage,
    CheckoutPage: RpowerOriginalCheckoutPage,
    OrderTrackingPage: RpowerOriginalOrderTrackingPage,
    OrderConfirmationPage: RpowerOriginalOrderConfirmationPage,
  },
  // Future templates go here, e.g.:
  // modern: { label: "Modern", MenuPage: ..., ... }
};

/** Ordered list used for admin UI dropdowns */
export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(
  ([value, { label, description }]) => ({ value, label, description }),
);
