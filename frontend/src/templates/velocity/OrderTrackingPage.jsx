import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/* Inject velocity theme variables (idempotent) */
const VELOCITY_STYLES = `
  :root {
    --vel-accent: #ff4405;
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

/* Compact horizontal step tracker */
const TRACK_STEPS = [
  { key: "pending", label: "Received" },
  { key: "confirmed", label: "Received" }, // alias — maps to same visual step
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

/* Deduplicated display steps */
const DISPLAY_STEPS = [
  { label: "Received", statuses: ["pending", "confirmed"] },
  { label: "Preparing", statuses: ["preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Delivered", statuses: ["delivered"] },
];

const HorizontalTracker = ({ status }) => {
  const activeIdx = useMemo(() => {
    for (let i = 0; i < DISPLAY_STEPS.length; i++) {
      if (DISPLAY_STEPS[i].statuses.includes(status)) return i;
    }
    return 0;
  }, [status]);

  return (
    <div className="flex items-center w-full px-2">
      {DISPLAY_STEPS.map((step, idx) => {
        const completed = idx < activeIdx;
        const current = idx === activeIdx;
        const isLast = idx === DISPLAY_STEPS.length - 1;

        return (
          <React.Fragment key={step.label}>
            {/* dot + label */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  completed
                    ? "bg-[var(--vel-accent)] border-[var(--vel-accent)]"
                    : current
                      ? "bg-white border-[var(--vel-accent)]"
                      : "bg-white border-[#ccc]"
                } ${current ? "ring-4 ring-[var(--vel-accent)]/20" : ""}`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                  current
                    ? "text-[var(--vel-accent)]"
                    : completed
                      ? "text-black/70"
                      : "text-black/30"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* connector line */}
            {!isLast && (
              <div className="flex-1 h-0.5 mx-1 mb-5 rounded-full overflow-hidden bg-[#e8e8e8]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: "var(--vel-accent)" }}
                  initial={{ width: 0 }}
                  animate={{ width: completed ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ─── Order Tracking Page ─────────────────────────────────── */
const VelocityOrderTrackingPage = () => {
  useVelocityTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const trackingMerchantId = order?.merchant_id;

  const { isConnected } = useOrderWebSocket({
    merchantId: trackingMerchantId,
    onOrderUpdate: (updated) => {
      if (updated && String(updated.id) === String(orderId)) {
        setOrder(updated);
      }
    },
  });

  const loadOrder = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        const res = await apiService.getOrderPublic(orderId, {
          _ts: Date.now(),
        });
        setOrder(res.data);
      } catch (err) {
        console.error("Failed to load order:", err);
        if (!silent) toast.error("Order not found");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  /* auto-poll every 10 s */
  useEffect(() => {
    const id = setInterval(() => loadOrder(true), 10000);
    return () => clearInterval(id);
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--vel-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-black/25" />
        <h2 className="text-xl font-black">Order Not Found</h2>
        <button
          onClick={() => navigate("/")}
          className="h-12 px-8 rounded-2xl vel-accent-bg font-bold"
        >
          Back Home
        </button>
      </div>
    );
  }

  const subtotal = order.subtotal || 0;
  const tax = order.tax || 0;
  const tip = order.tip || 0;
  const total = order.total || 0;

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#111]">
      {/* header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#eee] px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full bg-[#f4f4f4] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-lg leading-tight truncate">
            Order #{order.order_number || orderId.slice(-6).toUpperCase()}
          </h1>
          <p className="text-xs text-black/40 capitalize">{order.status}</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <span
              className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
              title="Live updates"
            />
          )}
          <button
            type="button"
            onClick={() => loadOrder(true)}
            className="w-9 h-9 rounded-full bg-[#f4f4f4] flex items-center justify-center"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* ── Horizontal step tracker ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl px-5 pt-6 pb-5 shadow-sm"
        >
          <HorizontalTracker status={order.status} />

          {/* status message */}
          <div className="mt-5 text-center">
            {order.status === "ready" || order.status === "delivered" ? (
              <p className="font-black text-[var(--vel-accent)] text-base">
                {order.status === "ready"
                  ? "Your order is ready! 🎉"
                  : "Order delivered ✓"}
              </p>
            ) : (
              <p className="text-sm text-black/50 font-semibold">
                {order.status === "preparing"
                  ? "Kitchen is working on your order…"
                  : "Order received — confirming with kitchen…"}
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Receipt summary (text-only) ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl px-5 py-5 shadow-sm"
        >
          <h2 className="text-xs font-black uppercase tracking-widest text-black/40 mb-4">
            Receipt
          </h2>

          {/* items */}
          <div className="space-y-1.5 mb-4">
            {(order.items || []).map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm text-black/70"
              >
                <span>
                  {item.quantity}× {item.name}
                  {item.modifiers?.length > 0 && (
                    <span className="text-xs text-black/40 ml-1">
                      ({item.modifiers.map((m) => m.option_name).join(", ")})
                    </span>
                  )}
                </span>
                <span>
                  ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="h-px bg-[#eee] mb-3" />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-black/55">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-black/55">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-black/55">
                <span>Tip</span>
                <span>${tip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base pt-2 border-t border-[#eee]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* order meta */}
          <div className="mt-4 pt-3 border-t border-[#eee] space-y-1 text-xs text-black/40">
            {order.delivery_type && (
              <p>
                <span className="font-semibold">Type:</span>{" "}
                {order.delivery_type === "DELIVERY" ? "Delivery" : "Pickup"}
              </p>
            )}
            {order.customer?.name && (
              <p>
                <span className="font-semibold">Name:</span>{" "}
                {order.customer.name}
              </p>
            )}
            <p>
              <span className="font-semibold">Order ID:</span>{" "}
              <span className="font-mono">{orderId}</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VelocityOrderTrackingPage;
