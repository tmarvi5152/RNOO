import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useVantageTheme } from "./VantageTheme";

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];

const VantageOrderTrackingPage = () => {
  useVantageTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const { isConnected } = useOrderWebSocket({
    onOrderUpdate: (updatedOrder) => {
      if (updatedOrder.id === orderId) {
        setOrder(updatedOrder);
      }
    },
  });

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getOrderPublic(orderId);
      setOrder(res.data);
    } catch (err) {
      console.error("Failed to load order:", err);
      toast.error("Order not found");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const activeIdx = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, STATUS_STEPS.indexOf(order.status));
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f8f5] px-6 py-12">
        <div className="max-w-3xl mx-auto vantage-surface p-10">
          Loading order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f8f8f5] px-6 py-12">
        <div className="max-w-3xl mx-auto vantage-surface p-10 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-black/35 mb-3" />
          <h1 className="text-2xl font-light">Order Not Found</h1>
          <Button onClick={() => navigate("/")} className="mt-4 rounded-full">
            Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fcfbf6_0%,_#f4f1ea_55%,_#ebe4d8_100%)]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <button
              onClick={() => navigate("/")}
              className="mb-3 inline-flex items-center gap-2 text-sm text-black/70 hover:text-black"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-black/50 mb-1">
              Vantage Live Status
            </p>
            <h1 className="text-4xl md:text-5xl font-light tracking-wide">Track Order</h1>
            <p className="text-black/60 mt-1">Order #{order.order_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="vantage-pill px-3 py-1">
              {order.status}
            </Badge>
            {isConnected && (
              <Badge
                variant="outline"
                className="vantage-pill px-3 py-1 border-green-500 text-green-700"
              >
                Live
              </Badge>
            )}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={loadOrder}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 vantage-surface p-6 shadow-[0_15px_45px_rgba(20,20,20,0.08)]">
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
                    className="flex gap-4 p-3 rounded-xl bg-white/45"
                  >
                    <div className="pt-1">
                      <span
                        className={`w-4 h-4 rounded-full block ${
                          completed ? "bg-black" : "bg-black/20"
                        } ${current ? "animate-pulse" : ""}`}
                      />
                    </div>
                    <div>
                      <p
                        className={`capitalize font-medium ${completed ? "text-black" : "text-black/45"}`}
                      >
                        {status}
                      </p>
                      <p className="text-sm text-black/55">
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

          <div className="vantage-surface p-6">
            <h2 className="text-xl font-medium mb-4">Receipt</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-black/65">
                <span>Subtotal</span>
                <span>${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-black/65">
                <span>Tax</span>
                <span>${(order.tax || 0).toFixed(2)}</span>
              </div>
              {(order.tip || 0) > 0 && (
                <div className="flex justify-between text-black/65">
                  <span>Tip</span>
                  <span>${(order.tip || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2">
                <span>Total</span>
                <span>${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VantageOrderTrackingPage;
