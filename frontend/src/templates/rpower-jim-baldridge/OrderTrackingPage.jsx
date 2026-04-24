import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRpowerJimBaldridgeTheme } from "./Theme";
import LegacyLockup from "./LegacyLockup";

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];

const RpowerJimBaldridgeOrderTrackingPage = () => {
  useRpowerJimBaldridgeTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { isConnected } = useOrderWebSocket({
    onOrderUpdate: (updatedOrder) => {
      if (String(updatedOrder.id) === String(orderId)) {
        setOrder(updatedOrder);
      }
    },
  });

  const loadOrder = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const res = await apiService.getOrderPublic(orderId);
      setOrder(res.data);
    } catch (err) {
      console.error("Failed to load order:", err);
      if (!silent) toast.error("Order not found");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadOrder(true);
    }, 10000);
    return () => clearInterval(intervalId);
  }, [loadOrder]);

  const activeIdx = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, STATUS_STEPS.indexOf(order.status));
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1115] px-6 py-12 text-white">
        <div className="max-w-3xl mx-auto rjb-surface p-10">
          Loading order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#0f1115] px-6 py-12 text-white">
        <div className="max-w-3xl mx-auto rjb-surface p-10 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-white/35 mb-3" />
          <h1 className="text-2xl font-light">Order Not Found</h1>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full">
            Back Home
          </Button>
          <LegacyLockup className="mt-4" compact />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <button
              onClick={() => navigate("/")}
              className="mb-3 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-[#f6c453]/80 mb-1">
              RPOWER Legacy Tracking
            </p>
            <h1 className="text-4xl md:text-5xl font-light tracking-wide">
              Track Order
            </h1>
            <p className="text-white/60 mt-1">Order #{order.order_number}</p>
            <LegacyLockup className="mt-2" compact />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rjb-pill px-3 py-1 text-white">
              {order.status}
            </Badge>
            {isConnected && (
              <Badge
                variant="outline"
                className="rjb-pill px-3 py-1 border-green-500 text-green-300"
              >
                Live
              </Badge>
            )}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => loadOrder(true)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 rjb-surface p-6">
            <h2 className="text-xl font-medium mb-6">Status Timeline</h2>
            <div className="space-y-4">
              {STATUS_STEPS.map((status, idx) => {
                const completed = idx <= activeIdx;
                const current = idx === activeIdx;
                return (
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-4 p-3 rounded-xl bg-black/25"
                  >
                    <div className="pt-1">
                      <span
                        className={`w-4 h-4 rounded-full block ${completed ? "bg-[#f6c453]" : "bg-white/20"} ${current ? "animate-pulse" : ""}`}
                      />
                    </div>
                    <div>
                      <p
                        className={`capitalize font-medium ${completed ? "text-white" : "text-white/45"}`}
                      >
                        {status}
                      </p>
                      <p className="text-sm text-white/55">
                        {current
                          ? "Currently in progress"
                          : "Completed or upcoming"}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="rjb-surface p-6">
            <h2 className="text-xl font-medium mb-4">Receipt</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Subtotal</span>
                <span>${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Tax</span>
                <span>${(order.tax || 0).toFixed(2)}</span>
              </div>
              {(order.tip || 0) > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>Tip</span>
                  <span>${(order.tip || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2">
                <span>Total</span>
                <span className="text-[#f6c453]">
                  ${(order.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpowerJimBaldridgeOrderTrackingPage;
