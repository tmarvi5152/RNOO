import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Store,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { useJukeboxTheme } from "./JukeboxTheme";
import {
  calculateDiscountAmount,
  findDiscountByCode,
  normalizeDiscountCode,
  toMoney,
} from "../../lib/discounts";

const JukeboxCheckoutPage = () => {
  useJukeboxTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, merchantId, getSubtotal, getTax, clearCart } = useCartStore();

  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [orderType, setOrderType] = useState("pickup");
  const [orderTiming, setOrderTiming] = useState("asap");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tip, setTip] = useState(0);
  const [tipSelection, setTipSelection] = useState(null);
  const [customTipInput, setCustomTipInput] = useState("");
  const [merchant, setMerchant] = useState(null);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");

  const subtotal = getSubtotal();
  const tax = getTax();
  const isCardPayment = paymentMethod === "demo_card";
  const effectiveTip = isCardPayment ? tip : 0;

  const loadMerchant = useCallback(async () => {
    try {
      const res = await apiService.getMerchantBySlug(slug);
      setMerchant(res.data || null);
    } catch {
      setMerchant(null);
    }
  }, [slug]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  const selectedDiscountOption = findDiscountByCode(merchant, appliedPromoCode);
  const deliveryFee =
    orderType === "delivery" ? toMoney(merchant?.delivery_fee_amount || 0) : 0;
  const discountBase = toMoney(subtotal + tax + deliveryFee);
  const discountAmount = calculateDiscountAmount(
    discountBase,
    selectedDiscountOption,
  );
  const total = toMoney(discountBase - discountAmount + effectiveTip);

  useEffect(() => {
    if (!isCardPayment) {
      setTip(0);
      setTipSelection(null);
      setCustomTipInput("");
    }
  }, [isCardPayment]);

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }, []);

  const timeOptions = useMemo(() => {
    const out = [];
    for (let h = 9; h <= 21; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 21 && m > 0) continue;
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, []);

  const validate = () => {
    if (!customer.name.trim()) return "Please enter your full name";
    if (!customer.phone.trim()) return "Please enter your phone number";
    if (orderType === "delivery") {
      if (
        !customer.address_line1.trim() ||
        !customer.city.trim() ||
        !customer.zip_code.trim()
      ) {
        return "Please complete delivery address (street, city, ZIP)";
      }
    }
    if (orderTiming !== "asap" && (!scheduledDate || !scheduledTime)) {
      return "Please select both a date and time";
    }
    if (!paymentMethod) return "Please select a payment method";
    if (!items.length) return "Your cart is empty";
    if (!(merchantId || merchant?.id))
      return "Merchant context is missing. Please reopen the menu and try again.";
    return null;
  };

  const handleApplyPromo = async () => {
    const normalizedCode = normalizeDiscountCode(promoCodeInput);
    if (!normalizedCode) {
      toast.error("Enter a promo code to apply");
      return;
    }
    try {
      const response = await apiService.validateDiscount({
        merchant_id: merchantId || merchant?.id,
        discount_code: normalizedCode,
        subtotal,
        tax,
        delivery_type: orderType === "delivery" ? "DELIVERY" : "TAKEOUT",
        customer_email: customer.email,
        customer_phone: customer.phone,
        existing_discount_option_id: selectedDiscountOption?.id,
      });
      const validatedCode =
        normalizeDiscountCode(response?.data?.discount_code) || normalizedCode;
      const validatedAmount = Number(response?.data?.discount_amount || 0);
      setAppliedPromoCode(validatedCode);
      setPromoCodeInput(validatedCode);
      toast.success(
        validatedAmount > 0
          ? `Promo ${validatedCode} applied (-$${validatedAmount.toFixed(2)})`
          : `Promo ${validatedCode} applied`,
      );
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : "Unable to apply promo code",
      );
    }
  };

  const handleClearPromo = () => {
    setPromoCodeInput("");
    setAppliedPromoCode("");
  };

  const placeOrder = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const methodMap = {
        demo_card: "mock_card",
        pay_at_store: "pay_at_store",
        apple_pay: "mock_card",
        google_pay: "mock_card",
      };

      const payload = {
        merchant_id: merchantId || merchant?.id,
        customer: {
          name: customer.name,
          email: customer.email || "guest@rnoo.com",
          phone: customer.phone,
          address_line1:
            orderType === "delivery" ? customer.address_line1 : null,
          address_line2:
            orderType === "delivery" ? customer.address_line2 : null,
          city: orderType === "delivery" ? customer.city : null,
          state: orderType === "delivery" ? customer.state : null,
          zip_code: orderType === "delivery" ? customer.zip_code : null,
        },
        delivery_type: orderType === "delivery" ? "DELIVERY" : "TAKEOUT",
        items: items.map((item) => ({
          menu_item_id: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.basePrice,
          plu: item.plu || "",
          shepherd_pos_id: item.shepherd_pos_id || "",
          modifiers: (item.modifiers || []).map((mod) => ({
            group_id: mod.group_id || "default",
            group_name: mod.group_name || "Modifier",
            option_id: mod.option_id || "default",
            option_name: mod.option_name || mod.name || "Option",
            price: mod.price || 0,
            plu: mod.plu || "",
            shepherd_pos_id: mod.shepherd_pos_id || "",
          })),
          special_instructions: item.specialInstructions || null,
        })),
        payment: {
          method: methodMap[paymentMethod] || "pay_at_store",
          amount: total,
          tip: effectiveTip,
          status: "pending",
        },
        discount_option_id: selectedDiscountOption?.id || null,
        discount_code: normalizeDiscountCode(appliedPromoCode) || null,
        order_timing: orderTiming === "asap" ? "ASAP" : "FUTURE",
        scheduled_date: orderTiming === "asap" ? null : scheduledDate,
        scheduled_time: orderTiming === "asap" ? null : scheduledTime,
        notes: notes || null,
      };

      const res = await apiService.createOrder(payload);
      clearCart();
      setPromoCodeInput("");
      setAppliedPromoCode("");
      toast.success("Order placed");
      window.open(
        `/order-confirmation?orderId=${encodeURIComponent(res.data.id)}&merchantSlug=${encodeURIComponent(slug)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
        "_blank",
      );
      navigate(`/order/${slug}`);
    } catch (err) {
      console.error("Failed to place order", err);
      let msg = "Failed to place order";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") msg = detail;
      if (Array.isArray(detail) && detail.length) {
        msg = detail
          .map((e) => e.msg || e.message || "Validation error")
          .join(", ");
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="juke-shell min-h-screen px-3 py-3">
      <div className="max-w-6xl mx-auto">
        <header className="juke-hero p-4 rounded-lg mb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/80">
                Vintage Diner Checkout
              </p>
              <h1 className="juke-neon text-5xl sm:text-6xl leading-none mt-2">
                Settle the tab
              </h1>
              <p className="mt-2 text-white/85 font-semibold">
                One last stop before the kitchen gets your ticket.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-white/80">
                Total
              </p>
              <p className="text-4xl text-white font-black">
                ${total.toFixed(2)}
              </p>
            </div>
          </div>
        </header>

        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="juke-checkout-chip active inline-flex items-center gap-2 text-xs font-semibold h-10 px-4 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to menu
        </button>

        <div className="juke-checker rounded mb-3" />

        <section className="juke-register rounded-lg p-4 md:p-5 text-sm md:text-base">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-1">
            <div className="space-y-4">
              <div className="juke-chrome-edge rounded-md p-2">
                <p className="text-xs uppercase tracking-[0.15em] text-black/75 px-1">
                  Guest Details
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="juke-checkout-input h-12 px-3"
                  placeholder="Full Name *"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                />
                <input
                  className="juke-checkout-input h-12 px-3"
                  placeholder="Phone *"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
                <input
                  className="juke-checkout-input h-12 px-3 md:col-span-2"
                  placeholder="Email"
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType("pickup")}
                  className={`juke-checkout-btn h-11 text-sm ${orderType === "pickup" ? "active" : ""}`}
                >
                  Pickup
                </button>
                <button
                  onClick={() => setOrderType("delivery")}
                  className={`juke-checkout-btn h-11 text-sm ${orderType === "delivery" ? "active" : ""}`}
                >
                  Delivery
                </button>
              </div>

              {orderType === "delivery" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="juke-checkout-input h-12 px-3 md:col-span-2"
                    placeholder="Address Line 1"
                    value={customer.address_line1}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        address_line1: e.target.value,
                      })
                    }
                  />
                  <input
                    className="juke-checkout-input h-12 px-3 md:col-span-2"
                    placeholder="Address Line 2"
                    value={customer.address_line2}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        address_line2: e.target.value,
                      })
                    }
                  />
                  <input
                    className="juke-checkout-input h-12 px-3 md:col-span-2"
                    placeholder="City"
                    value={customer.city}
                    onChange={(e) =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:col-span-2">
                    <input
                      className="juke-checkout-input h-12 px-3"
                      placeholder="State"
                      value={customer.state}
                      onChange={(e) =>
                        setCustomer({ ...customer, state: e.target.value })
                      }
                    />
                    <input
                      className="juke-checkout-input h-12 px-3"
                      placeholder="ZIP"
                      value={customer.zip_code}
                      onChange={(e) =>
                        setCustomer({ ...customer, zip_code: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold mb-2">Pickup Timing</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => setOrderTiming("asap")}
                    className={`juke-checkout-btn h-12 ${orderTiming === "asap" ? "active" : ""}`}
                  >
                    ASAP
                  </button>
                  <button
                    onClick={() => setOrderTiming("later")}
                    className={`juke-checkout-btn h-12 ${orderTiming === "later" ? "active" : ""}`}
                  >
                    Schedule
                  </button>
                </div>
                {orderTiming === "later" && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="juke-checkout-input h-12 px-2"
                    >
                      <option value="">Date</option>
                      {dateOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="juke-checkout-input h-12 px-2"
                    >
                      <option value="">Time</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Payment Method</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("demo_card")}
                    className={`juke-checkout-btn h-12 text-xs inline-flex items-center justify-center gap-1 ${paymentMethod === "demo_card" ? "active" : ""}`}
                  >
                    <CreditCard className="w-4 h-4" /> Credit / Debit Card
                    (demo)
                  </button>
                  <button
                    onClick={() => setPaymentMethod("pay_at_store")}
                    className={`juke-checkout-btn h-12 text-xs inline-flex items-center justify-center gap-1 ${paymentMethod === "pay_at_store" ? "active" : ""}`}
                  >
                    <Store className="w-4 h-4" /> Pay at Store
                  </button>
                </div>

                <div className="my-3 flex items-center gap-3">
                  <div className="h-px bg-black/20 flex-1" />
                  <span className="text-xs uppercase tracking-wide text-black/60">
                    or
                  </span>
                  <div className="h-px bg-black/20 flex-1" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("apple_pay")}
                    className={`juke-checkout-btn h-12 text-xs inline-flex items-center justify-center gap-1 ${paymentMethod === "apple_pay" ? "active" : ""}`}
                  >
                    <Smartphone className="w-4 h-4" /> Apple Pay
                  </button>
                  <button
                    onClick={() => setPaymentMethod("google_pay")}
                    className={`juke-checkout-btn h-12 text-xs inline-flex items-center justify-center gap-1 ${paymentMethod === "google_pay" ? "active" : ""}`}
                  >
                    <Smartphone className="w-4 h-4" /> Google Pay
                  </button>
                </div>

                {isCardPayment && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold mb-2">Add Tip</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() => {
                            setTipSelection(percent);
                            setCustomTipInput("");
                            setTip(
                              Number(((subtotal * percent) / 100).toFixed(2)),
                            );
                          }}
                          className={`juke-checkout-btn h-10 text-xs ${tipSelection === percent ? "active" : ""}`}
                        >
                          {percent}%
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setTipSelection("custom");
                          const parsed = Number(customTipInput || 0);
                          setTip(Number(parsed.toFixed(2)));
                        }}
                        className={`juke-checkout-btn h-10 text-xs ${tipSelection === "custom" ? "active" : ""}`}
                      >
                        Custom
                      </button>
                    </div>
                    {tipSelection === "custom" && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="juke-checkout-input h-11 px-3 mt-2 w-full"
                        placeholder="Enter tip amount"
                        value={customTipInput}
                        onChange={(e) => {
                          setCustomTipInput(e.target.value);
                          const parsed = Number(e.target.value || 0);
                          if (!Number.isNaN(parsed)) {
                            setTip(Number(parsed.toFixed(2)));
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-sm font-semibold mb-2">Promo Code</p>
                  <div className="flex gap-2">
                    <input
                      className="juke-checkout-input h-11 px-3 w-full"
                      placeholder="Enter promo code"
                      value={promoCodeInput}
                      onChange={(e) =>
                        setPromoCodeInput(e.target.value.toUpperCase())
                      }
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="juke-checkout-btn h-11 px-4 text-xs"
                    >
                      Apply
                    </button>
                    {appliedPromoCode ? (
                      <button
                        type="button"
                        onClick={handleClearPromo}
                        className="juke-checkout-btn h-11 px-4 text-xs"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {appliedPromoCode ? (
                    <p className="text-xs text-emerald-300 mt-1">
                      Applied: {appliedPromoCode}
                    </p>
                  ) : null}
                </div>
              </div>

              <textarea
                rows={3}
                className="juke-checkout-input w-full p-3"
                placeholder="Order notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <aside className="juke-ticket-card p-3 h-fit lg:sticky lg:top-3">
              <p className="text-xs uppercase tracking-wider text-white/80">
                Ticket Total
              </p>
              <div className="mt-2 text-sm font-mono space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount ({selectedDiscountOption?.code})</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {effectiveTip > 0 && (
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <span>${effectiveTip.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-white/30 my-1" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={placeOrder}
                disabled={submitting || !items.length}
                className="mt-3 w-full h-12 juke-ring-btn text-sm"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Placing
                    Order...
                  </span>
                ) : (
                  `Place Order • $${total.toFixed(2)}`
                )}
              </button>
            </aside>
          </div>
        </section>

        <div className="juke-checker rounded mt-3" />
      </div>
    </div>
  );
};

export default JukeboxCheckoutPage;
