import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import RpowerOriginalHeroBanner from "./HeroBanner";

// ─── Step definitions ─────────────────────────────────────────────────────────

const TRACK_STEPS = [
  {
    key: "received",
    label: "Order Received",
    detail: "Your order has been sent to the restaurant.",
    statuses: ["pending", "confirmed"],
  },
  {
    key: "preparing",
    label: "Preparing",
    detail: "The kitchen is preparing your order.",
    statuses: ["preparing"],
  },
  {
    key: "ready",
    label: "Ready for Pickup",
    detail: "Your order is ready!",
    statuses: ["ready"],
  },
  {
    key: "delivered",
    label: "Delivered",
    detail: "Your order has been completed.",
    statuses: ["delivered"],
  },
];

const stepIndexForStatus = (status) => {
  for (let i = 0; i < TRACK_STEPS.length; i++) {
    if (TRACK_STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
};

// ─── Vertical tracker ─────────────────────────────────────────────────────────

const VerticalTracker = ({ status }) => {
  const active = stepIndexForStatus(status);

  return (
    <div className="space-y-0">
      {TRACK_STEPS.map((step, idx) => {
        const completed = idx < active;
        const current = idx === active;
        const isLast = idx === TRACK_STEPS.length - 1;

        return (
          <div key={step.key} className="flex gap-5">
            {/* Left: dot + connector */}
            <div className="flex flex-col items-center" style={{ width: 24 }}>
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all"
                style={{
                  background:
                    completed || current ? "var(--ro-red)" : "#ffffff",
                  borderColor:
                    completed || current ? "var(--ro-red)" : "#e2e8f0",
                  boxShadow: current
                    ? "0 0 0 4px rgba(211,173,103,0.18)"
                    : "none",
                  zIndex: 1,
                }}
              >
                {completed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {current && (
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#ffffff" }}
                  />
                )}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 mt-1"
                  style={{
                    flex: 1,
                    minHeight: 40,
                    background: completed ? "var(--ro-red)" : "#e2e8f0",
                  }}
                />
              )}
            </div>

            {/* Right: text */}
            <div className={`pb-8 min-w-0 ${isLast ? "pb-0" : ""}`}>
              <p
                className="text-sm font-semibold leading-tight"
                style={{ color: completed || current ? "#f8fafc" : "#94a3b8" }}
              >
                {step.label}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: completed || current ? "#cbd5e1" : "#94a3b8" }}
              >
                {step.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RpowerOriginalOrderTrackingPage = () => {
  useRpowerOriginalTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { isConnected } = useOrderWebSocket({
    merchantId: order?.merchant_id,
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
      } catch {
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

  useEffect(() => {
    const id = setInterval(() => loadOrder(true), 10000);
    return () => clearInterval(id);
  }, [loadOrder]);

  const statusLabel = useMemo(() => {
    if (!order) return "";
    const map = {
      pending: "Order Received",
      confirmed: "Confirmed",
      preparing: "Preparing",
      ready: "Ready for Pickup",
      delivered: "Delivered",
    };
    return map[order.status] || order.status;
  }, [order]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "transparent" }}
      >
        <RpowerOriginalHeroBanner title="Order Status" compact />
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--ro-red)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!order) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "transparent" }}
      >
        <RpowerOriginalHeroBanner title="Order Status" compact />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <AlertCircle
            className="w-12 h-12 mb-4"
            style={{ color: "#cbd5e1" }}
          />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f8fafc" }}>
            Order Not Found
          </h1>
          <p className="text-sm mb-8" style={{ color: "#cbd5e1" }}>
            We couldn't locate order #{orderId}.
          </p>
          <button
            className="ro-btn-primary px-8 py-3"
            onClick={() => navigate("/")}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      <RpowerOriginalHeroBanner
        title="Order Status"
        subtitle={isConnected ? "Live updates enabled" : ""}
        compact
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => loadOrder(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="ro-btn-outline h-9 px-3 text-xs"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
        {/* Status hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="ro-panel p-6 mb-5"
          style={{ borderLeft: "4px solid var(--ro-red)" }}
        >
          <p className="ro-label mb-1">Order Reference</p>
          <p className="text-2xl font-bold mb-3" style={{ color: "#f8fafc" }}>
            #{orderId}
          </p>
          {order.poscnx_ticket_number && (
            <p className="text-sm mb-3" style={{ color: "#cbd5e1" }}>
              POS Ticket&nbsp;
              <span className="font-bold" style={{ color: "var(--ro-red)" }}>
                #{order.poscnx_ticket_number}
              </span>
            </p>
          )}
          <span
            className="inline-block text-xs font-bold px-3 py-1 rounded"
            style={{
              background: "rgba(211, 173, 103, 0.16)",
              color: "var(--ro-red)",
              border: "1px solid var(--ro-red)",
            }}
          >
            {statusLabel}
          </span>
        </motion.div>

        {/* Progress tracker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="ro-panel p-6 mb-5"
        >
          <p className="ro-label mb-6">Progress</p>
          <VerticalTracker status={order.status} />
        </motion.div>

        {/* Items */}
        {order.items?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="ro-panel p-6 mb-6"
          >
            <p className="ro-label mb-4">Items Ordered</p>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm"
                  style={{ color: "#cbd5e1" }}
                >
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>
                    ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="ro-btn-outline flex-1 py-2.5 text-sm"
            onClick={() => navigate("/")}
          >
            Back to Home
          </button>
          {order.merchant_slug && (
            <button
              className="ro-btn-primary flex-1 py-2.5 text-sm"
              onClick={() => navigate(`/order/${order.merchant_slug}`)}
            >
              Order Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RpowerOriginalOrderTrackingPage;

// ─── Status definitions ───────────────────────────────────────────────────────
