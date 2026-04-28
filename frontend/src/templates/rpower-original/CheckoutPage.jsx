import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { ArrowLeft, Check, CreditCard, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import RpowerOriginalHeroBanner from "./HeroBanner";

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field = ({ label, required, children }) => (
  <div>
    <label
      className="block text-xs font-semibold mb-1.5"
      style={{ color: "#cbd5e1", letterSpacing: "0.03em" }}
    >
      {label}
      {required && <span style={{ color: "var(--ro-red)" }}> *</span>}
    </label>
    {children}
  </div>
);

// ─── Section heading ──────────────────────────────────────────────────────────

const SectionHeading = ({ children }) => (
  <h2
    className="text-sm font-bold mb-4"
    style={{
      color: "#f8fafc",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      paddingBottom: "0.5rem",
      borderBottom: "2px solid var(--ro-red)",
    }}
  >
    {children}
  </h2>
);

// ─── Checkout Page ────────────────────────────────────────────────────────────

const RpowerOriginalCheckoutPage = () => {
  useRpowerOriginalTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, merchantId, getSubtotal, getTax, clearCart } = useCartStore();

  const blankCustomer = {
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
  };

  const [customer, setCustomer] = useState(blankCustomer);
  const [orderType, setOrderType] = useState("pickup");
  const [orderTiming, setOrderTiming] = useState("asap");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tip, setTip] = useState(0);
  const [tipSelection, setTipSelection] = useState(null);
  const [customTipInput, setCustomTipInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const subtotal = getSubtotal();
  const tax = getTax();
  const isCard = paymentMethod === "demo_card";
  const effectiveTip = isCard ? tip : 0;
  const total = subtotal + tax + effectiveTip;

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().split("T")[0];
      }),
    [],
  );

  const timeOptions = useMemo(() => {
    const opts = [];
    for (let h = 9; h <= 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 21 && m > 0) continue;
        opts.push(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        );
      }
    }
    return opts;
  }, []);

  const handleTip = (pct) => {
    setTipSelection(pct);
    setCustomTipInput("");
    setTip(Number(((subtotal * pct) / 100).toFixed(2)));
  };

  const handleCustomTip = (val) => {
    setCustomTipInput(val);
    setTipSelection("custom");
    const n = parseFloat(val);
    setTip(isNaN(n) || n < 0 ? 0 : Number(n.toFixed(2)));
  };

  const setField = (key, value) => setCustomer((p) => ({ ...p, [key]: value }));

  const validate = () => {
    if (!customer.name.trim()) return "Please enter your full name";
    if (!customer.phone.trim()) return "Please enter your phone number";
    if (
      orderType === "delivery" &&
      (!customer.address_line1.trim() ||
        !customer.city.trim() ||
        !customer.zip_code.trim())
    )
      return "Please complete the delivery address";
    if (orderTiming !== "asap" && (!scheduledDate || !scheduledTime))
      return "Please select a date and time for your order";
    if (!paymentMethod) return "Please select a payment method";
    if (!items.length) return "Your cart is empty";
    if (!merchantId)
      return "Merchant context missing — please reopen the menu and try again";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const methodMap = {
        demo_card: "mock_card",
        cash: "cash",
        pay_at_store: "pay_at_store",
      };
      const payload = {
        merchant_id: merchantId,
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
          modifiers: (item.modifiers || []).map((m) => ({
            group_id: m.group_id || "default",
            group_name: m.group_name || "Modifier",
            option_id: m.option_id || "default",
            option_name: m.option_name || m.name || "Option",
            price: m.price || 0,
            plu: m.plu || "",
            shepherd_pos_id: m.shepherd_pos_id || "",
          })),
          special_instructions: item.specialInstructions || null,
        })),
        payment: {
          method: methodMap[paymentMethod] || "cash",
          amount: total,
          tip: effectiveTip,
          status: "pending",
        },
        order_timing: orderTiming === "asap" ? "ASAP" : "FUTURE",
        scheduled_date: orderTiming === "asap" ? null : scheduledDate,
        scheduled_time: orderTiming === "asap" ? null : scheduledTime,
        notes: notes || null,
      };
      const res = await apiService.createOrder(payload);
      clearCart();
      toast.success("Order placed!");
      window.open(
        `/order-confirmation?orderId=${encodeURIComponent(res.data.id)}&merchantSlug=${encodeURIComponent(slug)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
        "_blank",
      );
      navigate(`/order/${slug}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = "Failed to place order";
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail) && detail.length > 0)
        msg = detail.map((e) => e.msg || "Validation error").join(", ");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Order summary helper ───────────────────────────────────────────────────
  const OrderSummary = () => (
    <div className="ro-panel p-5">
      <p className="ro-label mb-4">Order Summary</p>
      <div className="space-y-2 text-sm mb-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between"
            style={{ color: "#cbd5e1" }}
          >
            <span className="truncate mr-2">
              {item.quantity}× {item.name}
            </span>
            <span className="shrink-0">${item.totalPrice.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="ro-divider mb-4" />
      <div className="space-y-2 text-sm">
        <div className="flex justify-between" style={{ color: "#cbd5e1" }}>
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between" style={{ color: "#cbd5e1" }}>
          <span>Tax</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        {effectiveTip > 0 && (
          <div className="flex justify-between" style={{ color: "#cbd5e1" }}>
            <span>Tip</span>
            <span>${effectiveTip.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="ro-divider my-4" />
      <div
        className="flex justify-between font-bold text-base mb-5"
        style={{ color: "#f8fafc" }}
      >
        <span>Total</span>
        <span style={{ color: "var(--ro-red)" }}>${total.toFixed(2)}</span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="ro-btn-primary w-full h-12"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? "Placing Order…" : "Place Order"}
      </button>
      <p className="text-xs text-center mt-3" style={{ color: "#94a3b8" }}>
        Processed securely by RPOWER POS
      </p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      <RpowerOriginalHeroBanner title="Checkout" compact />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => navigate(`/order/${slug}/cart`)}
          className="ro-btn-ghost mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row gap-6"
        >
          {/* ── Form ── */}
          <div className="flex-1 space-y-6">
            {/* Order type */}
            <div className="ro-panel p-5">
              <SectionHeading>Order Type</SectionHeading>
              <div className="ro-toggle-wrap">
                {[
                  { value: "pickup", label: "Pickup" },
                  { value: "delivery", label: "Delivery" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOrderType(opt.value)}
                    className={`ro-toggle-btn${orderType === opt.value ? " ro-toggle-active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* When */}
            <div className="ro-panel p-5">
              <SectionHeading>When</SectionHeading>
              <div className="ro-toggle-wrap mb-4">
                {[
                  { value: "asap", label: "As Soon As Possible" },
                  { value: "schedule", label: "Schedule" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOrderTiming(opt.value)}
                    className={`ro-toggle-btn${orderTiming === opt.value ? " ro-toggle-active" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {orderTiming === "schedule" && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Field label="Date" required>
                    <select
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="ro-select"
                    >
                      <option value="">Select date</option>
                      {dateOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Time" required>
                    <select
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="ro-select"
                    >
                      <option value="">Select time</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </div>

            {/* Contact info */}
            <div className="ro-panel p-5">
              <SectionHeading>Contact Information</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" required>
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="Jane Smith"
                    className="ro-input"
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder="(555) 000-0000"
                    className="ro-input"
                  />
                </Field>
                <Field label="Email (optional)">
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder="jane@example.com"
                    className="ro-input"
                  />
                </Field>
              </div>
            </div>

            {/* Delivery address */}
            {orderType === "delivery" && (
              <div className="ro-panel p-5">
                <SectionHeading>Delivery Address</SectionHeading>
                <div className="space-y-4">
                  <Field label="Street Address" required>
                    <input
                      type="text"
                      value={customer.address_line1}
                      onChange={(e) =>
                        setField("address_line1", e.target.value)
                      }
                      placeholder="123 Main St"
                      className="ro-input"
                    />
                  </Field>
                  <Field label="Apt / Suite">
                    <input
                      type="text"
                      value={customer.address_line2}
                      onChange={(e) =>
                        setField("address_line2", e.target.value)
                      }
                      placeholder="Apt 4B"
                      className="ro-input"
                    />
                  </Field>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Field label="City" required>
                      <input
                        type="text"
                        value={customer.city}
                        onChange={(e) => setField("city", e.target.value)}
                        placeholder="City"
                        className="ro-input"
                      />
                    </Field>
                    <Field label="State">
                      <input
                        type="text"
                        value={customer.state}
                        onChange={(e) => setField("state", e.target.value)}
                        placeholder="TX"
                        className="ro-input"
                        maxLength={2}
                      />
                    </Field>
                    <Field label="ZIP" required>
                      <input
                        type="text"
                        value={customer.zip_code}
                        onChange={(e) => setField("zip_code", e.target.value)}
                        placeholder="78201"
                        className="ro-input"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="ro-panel p-5">
              <SectionHeading>Payment Method</SectionHeading>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Apple Pay is not available in demo mode")
                  }
                  className="h-11 rounded-xl bg-black text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 fill-white"
                    aria-hidden
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Apple Pay
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Google Pay is not available in demo mode")
                  }
                  className="h-11 rounded-xl border border-slate-300 bg-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google Pay
                </button>
              </div>

              <p className="text-xs text-slate-400 text-center uppercase tracking-wider mb-3">
                or select below
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    value: "demo_card",
                    label: "Demo Credit Card",
                    Icon: CreditCard,
                  },
                  { value: "pay_at_store", label: "Pay at Store", Icon: Store },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(value);
                      if (value !== "demo_card") {
                        setTip(0);
                        setTipSelection(null);
                        setCustomTipInput("");
                      }
                    }}
                    className={`ro-pay-option h-[52px] w-full${paymentMethod === value ? " ro-pay-active" : ""}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color:
                          paymentMethod === value ? "var(--ro-red)" : "#f8fafc",
                      }}
                    >
                      {label}
                    </span>
                    {paymentMethod === value && (
                      <Check
                        className="w-4 h-4 ml-auto"
                        style={{ color: "var(--ro-red)" }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tip */}
              {isCard && (
                <div className="mt-5">
                  <p className="ro-label mb-3">Add a Tip</p>
                  <div className="flex gap-2">
                    {[0, 15, 18, 20].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleTip(pct)}
                        className={`ro-tip-btn${tipSelection === pct && tipSelection !== "custom" ? " ro-tip-active" : ""}`}
                      >
                        {pct === 0 ? "No Tip" : `${pct}%`}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setTipSelection("custom");
                        setCustomTipInput("");
                        setTip(0);
                      }}
                      className={`ro-tip-btn${tipSelection === "custom" ? " ro-tip-active" : ""}`}
                    >
                      Custom
                    </button>
                  </div>
                  {tipSelection === "custom" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span style={{ color: "#cbd5e1" }}>$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customTipInput}
                        onChange={(e) => handleCustomTip(e.target.value)}
                        placeholder="0.00"
                        className="ro-input"
                        style={{ maxWidth: "120px" }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="ro-panel p-5">
              <SectionHeading>Order Notes</SectionHeading>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Allergies, special requests, or other instructions…"
                className="ro-textarea text-sm"
              />
            </div>

            {/* Mobile summary + submit */}
            <div className="lg:hidden">
              <OrderSummary />
            </div>
          </div>

          {/* ── Desktop order summary ── */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24">
              <OrderSummary />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RpowerOriginalCheckoutPage;
