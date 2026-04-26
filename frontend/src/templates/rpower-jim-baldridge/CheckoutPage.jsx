import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  ShieldCheck,
  Store,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  persistRpowerJimBaldridgeLegacyMode,
  useRpowerJimBaldridgeTheme,
} from "./Theme";
import LegacyLockup from "./LegacyLockup";

const RpowerJimBaldridgeCheckoutPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, merchantId, getSubtotal, getTax, clearCart } = useCartStore();
  const [merchant, setMerchant] = useState(null);

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
  const legacyMode = Boolean(merchant?.shepherd_config?.rjb_legacy_mode);

  useRpowerJimBaldridgeTheme(legacyMode);

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

  useEffect(() => {
    if (merchant) {
      persistRpowerJimBaldridgeLegacyMode(legacyMode);
    }
  }, [merchant, legacyMode]);

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
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate(`/order/${slug}/cart`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rjb-surface p-6 md:p-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#f6c453]/80">
                {legacyMode
                  ? "Legacy Ledger Checkout"
                  : "Classic Ticket Checkout"}
              </p>
              <h1 className="text-4xl md:text-5xl font-light tracking-wide mt-2">
                Secure Ticket
              </h1>
              <p className="text-white/65 mt-2 max-w-2xl">
                Structured like a service ledger for accuracy and clarity before
                kitchen handoff.
              </p>
            </div>
            <div className="rjb-pill px-3 py-2 text-sm text-[#f6c453] inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Verified Checkout
            </div>
            {legacyMode ? <LegacyLockup className="w-full" compact /> : null}
          </div>
        </motion.div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-7">
          <section className="xl:col-span-2 rjb-surface p-6 md:p-8 space-y-7 border-l-4 border-l-[#e8ba53]">
            <div className="flex items-center gap-3 text-[#e8ba53]">
              <Ticket className="w-4 h-4" />
              <p className="text-xs uppercase tracking-[0.16em]">
                Service Details
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                  className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Email</Label>
                <Input
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                  className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/55 mb-2">
                  Order Type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`h-11 border text-sm tracking-wide ${orderType === "pickup" ? "bg-[#d7ad54] text-black border-[#d7ad54]" : "border-[#e8ba5350] bg-[#101620] text-white/80"}`}
                    onClick={() => setOrderType("pickup")}
                  >
                    Pickup
                  </button>
                  <button
                    type="button"
                    className={`h-11 border text-sm tracking-wide ${orderType === "delivery" ? "bg-[#d7ad54] text-black border-[#d7ad54]" : "border-[#e8ba5350] bg-[#101620] text-white/80"}`}
                    onClick={() => setOrderType("delivery")}
                  >
                    Delivery
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/55 mb-2">
                  Timing
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`h-11 border text-sm tracking-wide ${orderTiming === "asap" ? "bg-[#cf2030] text-white border-[#cf2030]" : "border-[#e8ba5350] bg-[#101620] text-white/80"}`}
                    onClick={() => setOrderTiming("asap")}
                  >
                    ASAP
                  </button>
                  <button
                    type="button"
                    className={`h-11 border text-sm tracking-wide ${orderTiming === "future" ? "bg-[#cf2030] text-white border-[#cf2030]" : "border-[#e8ba5350] bg-[#101620] text-white/80"}`}
                    onClick={() => setOrderTiming("future")}
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </div>

            {orderType === "delivery" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Address *</Label>
                  <Input
                    value={customer.address_line1}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        address_line1: e.target.value,
                      })
                    }
                    className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={customer.city}
                    onChange={(e) =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                    className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                  />
                </div>
                <div>
                  <Label>ZIP *</Label>
                  <Input
                    value={customer.zip_code}
                    onChange={(e) =>
                      setCustomer({ ...customer, zip_code: e.target.value })
                    }
                    className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                  />
                </div>
              </div>
            )}

            {orderTiming === "future" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <select
                    className="w-full h-11 px-3 border rounded-sm bg-[#101620] border-[#e8ba5350] text-sm md:text-base"
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
                  <Label>Time</Label>
                  <select
                    className="w-full h-11 px-3 border rounded-sm bg-[#101620] border-[#e8ba5350] text-sm md:text-base"
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

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/55 mb-2">
                Payment
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Apple Pay is not available in demo mode")
                  }
                  className="h-11 rounded-lg bg-black text-white font-semibold text-sm flex items-center justify-center gap-2"
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
                  className="h-11 rounded-lg border border-[#e8ba5350] bg-[#101620] text-white font-semibold text-sm flex items-center justify-center gap-2"
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
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 mb-2 text-center">
                or select below
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  {
                    id: "demo_card",
                    label: "Demo Credit Card",
                    icon: CreditCard,
                  },
                  { id: "pay_at_store", label: "Pay at Store", icon: Store },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);
                      if (method.id !== "demo_card") {
                        setTip(0);
                        setTipSelection(null);
                        setCustomTipInput("");
                      }
                    }}
                    className={`h-11 border text-sm tracking-wide inline-flex items-center justify-center gap-2 ${
                      paymentMethod === method.id
                        ? "bg-[#d7ad54] text-black border-[#d7ad54]"
                        : "border-[#e8ba5350] bg-[#101620] text-white/80"
                    }`}
                  >
                    <method.icon className="w-4 h-4" />
                    {method.label}
                  </button>
                ))}
              </div>
              {paymentMethod === "demo_card" && (
                <p className="text-[11px] text-white/55 mt-2">
                  Demo mode only. No real card details are captured.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isCardPayment && (
                <div className="space-y-2">
                  <Label>Tip</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipSelection(pct);
                          setCustomTipInput("");
                          setTip(
                            Math.round(
                              ((subtotal * pct) / 100 + Number.EPSILON) * 100,
                            ) / 100,
                          );
                        }}
                        className={`h-10 border text-sm tracking-wide ${
                          tipSelection === pct
                            ? "bg-[#d7ad54] text-black border-[#d7ad54]"
                            : "border-[#e8ba5350] bg-[#101620] text-white/80"
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
                      className={`h-10 border text-sm tracking-wide ${
                        tipSelection === "custom"
                          ? "bg-[#d7ad54] text-black border-[#d7ad54]"
                          : "border-[#e8ba5350] bg-[#101620] text-white/80"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {tipSelection === "custom" && (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter custom tip"
                      value={customTipInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomTipInput(value);
                        setTip(parseFloat(value) || 0);
                      }}
                      className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                    />
                  )}
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                  className="bg-[#101620] border-[#e8ba5350] rounded-sm"
                />
              </div>
            </div>
          </section>

          <aside className="rjb-surface p-6 md:p-7 h-fit xl:sticky xl:top-8">
            <p className="text-xs uppercase tracking-[0.16em] text-[#e8ba53] mb-3">
              Order Ledger
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Items</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              {effectiveTip > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>Tip</span>
                  <span>${effectiveTip.toFixed(2)}</span>
                </div>
              )}
            </div>

            <Separator className="my-4 bg-white/15" />

            <div className="flex justify-between text-xl font-semibold">
              <span>Total Due</span>
              <span className="text-[#f6c453]">${total.toFixed(2)}</span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full mt-6 h-12 rounded-sm bg-[#cf2030] hover:bg-[#b11928] tracking-wide uppercase text-[13px]"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Placing Order...
                </span>
              ) : (
                `Submit Ticket • $${total.toFixed(2)}`
              )}
            </Button>

            <p className="mt-3 text-[11px] text-white/55 leading-relaxed">
              By submitting, you confirm item details and service timing.
            </p>
            {legacyMode ? <LegacyLockup className="mt-4" compact /> : null}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RpowerJimBaldridgeCheckoutPage;
