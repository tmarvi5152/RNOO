import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { ArrowLeft, CreditCard, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

const CRAVE_STYLES = `
  :root {
    --crv-accent: #ef4444;
    --crv-bg: #f8fafc;
    --crv-border: #e5e7eb;
  }
`;

function useCraveTheme() {
  useEffect(() => {
    const id = "crave-theme";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CRAVE_STYLES;
      document.head.appendChild(el);
    }
  }, []);
}

const StepAccordion = ({ title, number, open, onToggle, children }) => (
  <div className="rounded-2xl lg:rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full h-14 px-4 flex items-center justify-between text-left"
    >
      <p className="font-semibold text-slate-800">
        {number}. {title}
      </p>
      <span className="text-slate-400 text-xs">{open ? "Hide" : "Edit"}</span>
    </button>
    {open && <div className="px-4 pb-4">{children}</div>}
  </div>
);

const CraveCheckoutPage = () => {
  useCraveTheme();
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
  const [openStep, setOpenStep] = useState("details");
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

  const applyTipSelection = (type) => {
    setTipSelection(type);
    if (type === "custom") {
      const parsed = parseFloat(customTipInput);
      setTip(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
      return;
    }
    const tipMap = {
      10: subtotal * 0.1,
      15: subtotal * 0.15,
      20: subtotal * 0.2,
      0: 0,
    };
    setTip(tipMap[type] || 0);
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
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
      navigate(
        `/order-confirmation?orderId=${encodeURIComponent(res.data.id)}&merchantSlug=${encodeURIComponent(slug)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
      );
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,#ffe4e6_0%,#f8fafc_36%)] text-slate-900 pb-36 lg:pb-10">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[var(--crv-border)] h-14 px-4 lg:px-6 flex items-center gap-3">
        <div className="max-w-6xl mx-auto w-full flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/order/${slug}/cart`)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg flex-1">Checkout</h1>
          <span className="font-bold text-[var(--crv-accent)]">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-4 lg:px-6 py-4 grid lg:grid-cols-[1fr_360px] gap-5"
      >
        <div className="space-y-3">
          <StepAccordion
            number={1}
            title="Details"
            open={openStep === "details"}
            onToggle={() =>
              setOpenStep(openStep === "details" ? "" : "details")
            }
          >
            <div className="space-y-3">
              <input
                value={customer.name}
                onChange={(e) =>
                  setCustomer({ ...customer, name: e.target.value })
                }
                placeholder="Full name"
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
                placeholder="Phone"
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <input
                value={customer.email}
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
                placeholder="Email"
                className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType("pickup")}
                  className={`h-10 rounded-full text-sm font-semibold ${
                    orderType === "pickup"
                      ? "bg-[var(--crv-accent)] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("delivery")}
                  className={`h-10 rounded-full text-sm font-semibold ${
                    orderType === "delivery"
                      ? "bg-[var(--crv-accent)] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Delivery
                </button>
              </div>
              {orderType === "delivery" && (
                <div className="space-y-2">
                  <input
                    value={customer.address_line1}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        address_line1: e.target.value,
                      })
                    }
                    placeholder="Address"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    value={customer.city}
                    onChange={(e) =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                    placeholder="City"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <input
                    value={customer.zip_code}
                    onChange={(e) =>
                      setCustomer({ ...customer, zip_code: e.target.value })
                    }
                    placeholder="ZIP"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderTiming("asap")}
                  className={`h-10 rounded-full text-sm font-semibold ${
                    orderTiming === "asap"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  ASAP
                </button>
                <button
                  type="button"
                  onClick={() => setOrderTiming("scheduled")}
                  className={`h-10 rounded-full text-sm font-semibold ${
                    orderTiming === "scheduled"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Schedule
                </button>
              </div>
              {orderTiming !== "asap" && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
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
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
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
          </StepAccordion>

          <StepAccordion
            number={2}
            title="Payment"
            open={openStep === "payment"}
            onToggle={() =>
              setOpenStep(openStep === "payment" ? "" : "payment")
            }
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Apple Pay is not available in demo mode")
                  }
                  className="h-11 rounded-xl bg-black text-white font-semibold text-sm"
                >
                  Apple Pay
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Google Pay is not available in demo mode")
                  }
                  className="h-11 rounded-xl border border-slate-300 bg-white font-semibold text-sm"
                >
                  Google Pay
                </button>
              </div>
              <p className="text-xs text-slate-400 text-center uppercase tracking-wider">
                or
              </p>

              {[
                {
                  id: "demo_card",
                  label: "Demo Credit Card",
                  Icon: CreditCard,
                },
                { id: "cash", label: "Cash", Icon: Store },
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
                  className={`w-full h-11 rounded-xl border px-3 flex items-center justify-between text-sm font-semibold ${
                    paymentMethod === id
                      ? "border-[var(--crv-accent)] bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span>{label}</span>
                  <Icon className="w-4 h-4" />
                </button>
              ))}

              {isCardPayment && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Tip
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: "10", label: "10%" },
                      { value: "15", label: "15%" },
                      { value: "20", label: "20%" },
                      { value: "0", label: "No Tip" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => applyTipSelection(opt.value)}
                        className={`h-9 rounded-full text-xs font-semibold ${
                          tipSelection === opt.value
                            ? "bg-[var(--crv-accent)] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <input
                      value={customTipInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCustomTipInput(v);
                        setTipSelection("custom");
                        const p = parseFloat(v);
                        setTip(Number.isFinite(p) ? Math.max(0, p) : 0);
                      }}
                      placeholder="Custom tip"
                      className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </StepAccordion>

          <StepAccordion
            number={3}
            title="Notes"
            open={openStep === "notes"}
            onToggle={() => setOpenStep(openStep === "notes" ? "" : "notes")}
          >
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know?"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </StepAccordion>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-3xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
            <p className="text-xs text-slate-500 mt-1">
              {items.length} line item{items.length !== 1 ? "s" : ""}
            </p>

            <div className="mt-4 text-sm space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              {effectiveTip > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Tip</span>
                  <span>${effectiveTip.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-full bg-[var(--crv-accent)] text-white font-bold disabled:opacity-60 mt-5"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Placing Order...
                </span>
              ) : (
                `Place Order • $${total.toFixed(2)}`
              )}
            </button>
          </div>
        </aside>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--crv-border)] p-4 lg:hidden">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="text-sm">
            <p className="text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-900">
              ${total.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-12 px-7 rounded-full bg-[var(--crv-accent)] text-white font-bold disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Placing Order...
              </span>
            ) : (
              `Place Order • $${total.toFixed(2)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CraveCheckoutPage;
