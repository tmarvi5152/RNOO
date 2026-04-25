import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import {
  AlertCircle,
  ArrowLeft,
  ChefHat,
  CheckCircle2,
  Phone,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
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

const TIMELINE = [
  {
    label: "Order Received",
    statuses: ["pending", "confirmed"],
    Icon: CheckCircle2,
  },
  { label: "Cooking", statuses: ["preparing"], Icon: ChefHat },
  { label: "Ready", statuses: ["ready"], Icon: ShoppingBag },
  { label: "Completed", statuses: ["delivered"], Icon: CheckCircle2 },
];

const CraveOrderTrackingPage = () => {
  useCraveTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const trackingMerchantId = order?.merchant_id;

  const { isConnected } = useOrderWebSocket({
    merchantId: trackingMerchantId,
    onOrderUpdate: (updatedOrder) => {
      if (updatedOrder && String(updatedOrder.id) === String(orderId)) {
        setOrder(updatedOrder);
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

  useEffect(() => {
    const id = setInterval(() => loadOrder(true), 10000);
    return () => clearInterval(id);
  }, [loadOrder]);

  const activeStep = useMemo(() => {
    const status = order?.status;
    for (let i = 0; i < TIMELINE.length; i++) {
      if (TIMELINE[i].statuses.includes(status)) return i;
    }
    return 0;
  }, [order?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--crv-bg)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--crv-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--crv-bg)] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300" />
        <h2 className="text-xl font-bold">Order not found</h2>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="h-11 px-6 rounded-full bg-[var(--crv-accent)] text-white font-semibold"
        >
          Back Home
        </button>
      </div>
    );
  }

  const phoneNumber = order.customer?.phone || order.merchant?.phone || "";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,#ffe4e6_0%,#f8fafc_36%)] text-slate-900">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[var(--crv-border)] h-14 px-4 lg:px-6 flex items-center gap-3">
        <div className="max-w-6xl mx-auto w-full flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">
              Order #{order.order_number || orderId.slice(-6).toUpperCase()}
            </h1>
            <p className="text-xs text-slate-500 capitalize">{order.status}</p>
          </div>
          {isConnected && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <button
            type="button"
            onClick={() => loadOrder(true)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="Refresh order status"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-5 grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-slate-200 p-5 lg:p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Order Progress</h2>
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />
            <div className="space-y-5">
              {TIMELINE.map((step, idx) => {
                const done = idx < activeStep;
                const current = idx === activeStep;
                const Icon = step.Icon;
                return (
                  <div key={step.label} className="relative pl-12">
                    <motion.div
                      className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        done
                          ? "bg-[var(--crv-accent)] border-[var(--crv-accent)] text-white"
                          : current
                            ? "bg-red-50 border-[var(--crv-accent)] text-[var(--crv-accent)]"
                            : "bg-white border-slate-300 text-slate-400"
                      }`}
                      animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{
                        duration: 1.1,
                        repeat: current ? Infinity : 0,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                    <p
                      className={`text-sm font-semibold ${current ? "text-red-600" : "text-slate-700"}`}
                    >
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <a
              href={phoneNumber ? `tel:${phoneNumber}` : undefined}
              onClick={(e) => {
                if (!phoneNumber) {
                  e.preventDefault();
                  toast.info("Phone number unavailable");
                }
              }}
              className="w-full h-12 rounded-full bg-[var(--crv-accent)] text-white font-bold inline-flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Call Restaurant
            </a>
          </div>
        </div>

        <aside className="bg-white rounded-2xl lg:rounded-3xl border border-slate-200 p-5 shadow-sm h-fit lg:sticky lg:top-20">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Current status
          </p>
          <p className="text-2xl font-black text-[var(--crv-accent)] mt-1 capitalize">
            {order.status}
          </p>
          <div className="mt-4 text-sm space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span>Order #</span>
              <span className="font-semibold text-slate-900">
                {order.order_number || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-semibold text-slate-900">
                {order.delivery_type === "DELIVERY" ? "Delivery" : "Pickup"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Items</span>
              <span className="font-semibold text-slate-900">
                {order.items?.length || 0}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CraveOrderTrackingPage;
