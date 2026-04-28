import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ArrowLeft, CreditCard, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

/* Inject velocity theme variables (idempotent) */
const VELOCITY_STYLES = `
  :root {
    --vel-accent: #ff4405;
    --vel-accent-light: #fff1ed;
    --vel-bg: #f4f4f4;
    --vel-card: #ffffff;
    --vel-border: #e8e8e8;
    --vel-text: #111111;
  }
  .vel-accent-bg { background-color: var(--vel-accent) !important; color: #fff !important; }
`;

function useVelocityTheme() {
  useEffect(() => {
    const id = "velocity-theme";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = VELOCITY_STYLES;
      document.head.appendChild(el);
    }
  }, []);
}

/* Floating-label input component */
const FloatInput = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
}) => {
  const filled = value && value.length > 0;
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className={`peer w-full h-14 rounded-xl border border-[#e0e0e0] bg-white px-4 pt-5 pb-2 text-sm outline-none focus:border-[var(--vel-accent)] transition-colors`}
        placeholder=" "
      />
      <label
        className={`absolute left-4 top-1 text-[10px] font-semibold uppercase tracking-wide transition-all
          ${filled ? "text-[var(--vel-accent)]" : "text-black/40"}
          peer-focus:text-[var(--vel-accent)] peer-focus:top-1 peer-focus:text-[10px]
          peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal`}
      >
        {label}
        {required ? " *" : ""}
      </label>
    </div>
  );
};

/* Section card */
const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm">
    <h2 className="font-black text-sm uppercase tracking-wider text-black/40 mb-4">
      {title}
    </h2>
    {children}
  </div>
);

/* Toggle pill */
const PillToggle = ({ options, value, onChange }) => (
  <div className="flex gap-2">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`flex-1 h-10 rounded-xl font-bold text-sm transition-colors ${
          value === opt.value
            ? "vel-accent-bg"
            : "bg-[#f4f4f4] text-black/60 hover:bg-[#eee]"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

/* ─── Checkout Page ─────────────────────────────────────── */
const VelocityCheckoutPage = () => {
  useVelocityTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, merchantId, getSubtotal, getTax, clearCart } = useCartStore();

  const initialCustomer = {
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
  };

  const [submitting, setSubmitting] = useState(false);
  const [orderType, setOrderType] = useState("pickup");
  const [orderTiming, setOrderTiming] = useState("asap");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tip, setTip] = useState(0);
  const [tipSelection, setTipSelection] = useState(null);
  const [customTipInput, setCustomTipInput] = useState("");
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState(initialCustomer);

  const subtotal = getSubtotal();
  const tax = getTax();
  const isCardPayment = paymentMethod === "demo_card";
  const effectiveTip = isCardPayment ? tip : 0;
  const total = subtotal + tax + effectiveTip;

  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      return d.toISOString().split("T")[0];
    });
  }, []);

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 9; h <= 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 21 && m > 0) continue;
        const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        options.push(value);
      }
    }
    return options;
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
    if (!merchantId)
      return "Merchant context is missing. Please reopen the menu and try again.";
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
      const paymentMethodMap = {
        demo_card: "mock_card",
        cash: "cash",
        pay_at_store: "pay_at_store",
      };

      const orderData = {
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
          method: paymentMethodMap[paymentMethod] || "cash",
          amount: total,
          tip: effectiveTip,
          status: "pending",
        },
        order_timing: orderTiming === "asap" ? "ASAP" : "FUTURE",
        scheduled_date: orderTiming === "asap" ? null : scheduledDate,
        scheduled_time: orderTiming === "asap" ? null : scheduledTime,
        notes: notes || null,
      };

      const res = await apiService.createOrder(orderData);
      clearCart();
      setCustomer(initialCustomer);
      setNotes("");
      setOrderTiming("asap");
      setScheduledDate("");
      setScheduledTime("");
      setPaymentMethod("");
      setTip(0);
      setTipSelection(null);
      setCustomTipInput("");
      toast.success("Order placed!");
      window.open(
        `/order-confirmation?orderId=${encodeURIComponent(res.data.id)}&merchantSlug=${encodeURIComponent(slug)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
        "_blank",
      );
      navigate(`/order/${slug}`);
    } catch (err) {
      console.error("Failed to place order:", err);
      let msg = "Failed to place order";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") msg = detail;
      if (Array.isArray(detail) && detail.length > 0) {
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
    <div className="min-h-screen bg-[#f4f4f4] text-[#111]">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#eee] px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/order/${slug}/cart`)}
          className="w-9 h-9 rounded-full bg-[#f4f4f4] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-black text-xl flex-1">Checkout</h1>
        <span className="font-bold text-base text-[var(--vel-accent)]">
          ${total.toFixed(2)}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-32"
      >
        {/* ── Express Checkout ── */}
        <Section title="Express Checkout">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                toast.info("Apple Pay is not available in demo mode")
              }
              className="h-12 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-white"
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
              className="h-12 rounded-xl border-2 border-[#eee] bg-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
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
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-[#e8e8e8]" />
            <span className="text-xs font-semibold text-black/40 uppercase tracking-widest">
              or fill in details
            </span>
            <div className="flex-1 h-px bg-[#e8e8e8]" />
          </div>
        </Section>

        {/* ── Contact ── */}
        <Section title="Contact">
          <div className="space-y-3">
            <FloatInput
              label="Full Name"
              required
              value={customer.name}
              onChange={(e) =>
                setCustomer({ ...customer, name: e.target.value })
              }
              autoComplete="name"
            />
            <FloatInput
              label="Phone"
              required
              type="tel"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({ ...customer, phone: e.target.value })
              }
              autoComplete="tel"
            />
            <FloatInput
              label="Email"
              type="email"
              value={customer.email}
              onChange={(e) =>
                setCustomer({ ...customer, email: e.target.value })
              }
              autoComplete="email"
            />
          </div>
        </Section>

        {/* ── Delivery / Pickup ── */}
        <Section title="Order Type">
          <PillToggle
            options={[
              { value: "pickup", label: "Pickup" },
              { value: "delivery", label: "Delivery" },
            ]}
            value={orderType}
            onChange={setOrderType}
          />

          {orderType === "delivery" && (
            <div className="mt-4 space-y-3">
              <FloatInput
                label="Address"
                required
                value={customer.address_line1}
                onChange={(e) =>
                  setCustomer({ ...customer, address_line1: e.target.value })
                }
                autoComplete="address-line1"
              />
              <FloatInput
                label="Apt / Suite"
                value={customer.address_line2}
                onChange={(e) =>
                  setCustomer({ ...customer, address_line2: e.target.value })
                }
                autoComplete="address-line2"
              />
              <div className="grid grid-cols-2 gap-3">
                <FloatInput
                  label="City"
                  required
                  value={customer.city}
                  onChange={(e) =>
                    setCustomer({ ...customer, city: e.target.value })
                  }
                  autoComplete="address-level2"
                />
                <FloatInput
                  label="ZIP"
                  required
                  value={customer.zip_code}
                  onChange={(e) =>
                    setCustomer({ ...customer, zip_code: e.target.value })
                  }
                  autoComplete="postal-code"
                />
              </div>
            </div>
          )}
        </Section>

        {/* ── Timing ── */}
        <Section title="When">
          <PillToggle
            options={[
              { value: "asap", label: "ASAP" },
              { value: "future", label: "Schedule" },
            ]}
            value={orderTiming}
            onChange={setOrderTiming}
          />
          {orderTiming === "future" && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Date
                </Label>
                <select
                  className="w-full mt-1 h-12 px-3 rounded-xl border border-[#e0e0e0] bg-white text-sm outline-none focus:border-[var(--vel-accent)]"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                >
                  <option value="">Select date</option>
                  {dateOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Time
                </Label>
                <select
                  className="w-full mt-1 h-12 px-3 rounded-xl border border-[#e0e0e0] bg-white text-sm outline-none focus:border-[var(--vel-accent)]"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                >
                  <option value="">Select time</option>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Section>

        {/* ── Payment ── */}
        <Section title="Payment">
          <div className="space-y-3">
            {[
              { id: "demo_card", label: "Demo Credit Card", Icon: CreditCard },
              { id: "pay_at_store", label: "Pay at Store", Icon: Store },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPaymentMethod(id);
                  if (id !== "demo_card") {
                    setTip(0);
                    setTipSelection(null);
                    setCustomTipInput("");
                  }
                }}
                className={`w-full h-13 px-4 rounded-xl border-2 flex items-center gap-3 text-sm font-semibold transition-colors ${
                  paymentMethod === id
                    ? "border-[var(--vel-accent)] bg-[var(--vel-accent-light)] text-[var(--vel-accent)]"
                    : "border-[#e8e8e8] bg-white text-black/70 hover:border-black/30"
                }`}
                style={{ height: "52px" }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {paymentMethod === id && (
                  <span className="ml-auto text-[var(--vel-accent)] font-black">
                    ✓
                  </span>
                )}
              </button>
            ))}
            {isCardPayment && (
              <p className="text-xs text-black/40 pt-1">
                Demo mode — no real card data is collected.
              </p>
            )}
          </div>
        </Section>

        {/* ── Tip (card only) ── */}
        {isCardPayment && (
          <Section title="Tip">
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setTipSelection(pct);
                    setTip(Math.round(subtotal * (pct / 100) * 100) / 100);
                    setCustomTipInput("");
                  }}
                  className={`flex-1 h-11 rounded-xl border-2 font-bold text-sm transition-colors ${
                    tipSelection === pct
                      ? "border-[var(--vel-accent)] bg-[var(--vel-accent)] text-white"
                      : "border-[#e8e8e8] bg-white text-black/70 hover:border-black/30"
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setTipSelection("custom");
                  setTip(parseFloat(customTipInput) || 0);
                }}
                className={`flex-1 h-11 rounded-xl border-2 font-bold text-sm transition-colors ${
                  tipSelection === "custom"
                    ? "border-[var(--vel-accent)] bg-[var(--vel-accent)] text-white"
                    : "border-[#e8e8e8] bg-white text-black/70 hover:border-black/30"
                }`}
              >
                Custom
              </button>
            </div>

            {tipSelection === "custom" && (
              <div className="mt-3">
                <FloatInput
                  label="Custom Tip ($)"
                  type="number"
                  value={customTipInput}
                  onChange={(e) => {
                    setCustomTipInput(e.target.value);
                    setTip(parseFloat(e.target.value) || 0);
                  }}
                />
              </div>
            )}

            {tip > 0 && (
              <p className="text-sm text-black/50 mt-2">
                Tip: ${tip.toFixed(2)}
              </p>
            )}
          </Section>
        )}

        {/* ── Notes ── */}
        <Section title="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything else we should know?"
            className="rounded-xl border-[#e0e0e0] text-sm resize-none"
          />
        </Section>

        {/* ── Order Summary ── */}
        <Section title="Order Summary">
          <div className="space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-black/70">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>${item.totalPrice.toFixed(2)}</span>
              </div>
            ))}
            <div className="h-px bg-[#eee] my-2" />
            <div className="flex justify-between text-black/55">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-black/55">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            {effectiveTip > 0 && (
              <div className="flex justify-between text-black/55">
                <span>Tip</span>
                <span>${effectiveTip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base pt-2 border-t border-[#eee]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </Section>
      </motion.div>

      {/* sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#eee] px-4 py-4 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-14 rounded-2xl vel-accent-bg font-black text-lg flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Placing Order...
            </>
          ) : (
            `Place Order — $${total.toFixed(2)}`
          )}
        </button>
      </div>
    </div>
  );
};

export default VelocityCheckoutPage;
