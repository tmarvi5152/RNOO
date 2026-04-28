import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CarFront, RefreshCw } from "lucide-react";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { toast } from "sonner";
import { useJukeboxTheme } from "./JukeboxTheme";

const DISPLAY_STEPS = [
  { label: "Received", statuses: ["pending", "confirmed"] },
  { label: "Preparing", statuses: ["preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Delivered", statuses: ["delivered"] },
];

const JukeboxOrderTrackingPage = () => {
  useJukeboxTheme();
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const merchantId = order?.merchant_id;
  const { isConnected } = useOrderWebSocket({
    merchantId,
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
        console.error("Failed to load order", err);
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

  const activeIdx = useMemo(() => {
    if (!order) return 0;
    for (let i = 0; i < DISPLAY_STEPS.length; i += 1) {
      if (DISPLAY_STEPS[i].statuses.includes(order.status)) return i;
    }
    return 0;
  }, [order]);

  const routePercent = useMemo(() => {
    if (DISPLAY_STEPS.length <= 1) return 0;
    return (activeIdx / (DISPLAY_STEPS.length - 1)) * 100;
  }, [activeIdx]);

  if (loading) {
    return (
      <div className="juke-shell min-h-screen grid place-items-center">
        <div className="w-10 h-10 rounded-full border-4 border-[var(--juke-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="juke-shell min-h-screen px-3 py-10">
        <div className="max-w-xl mx-auto juke-register p-6 rounded-lg text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-black/40" />
          <p className="text-2xl juke-item-title mt-1">Ticket not found</p>
          <button
            onClick={() => navigate("/")}
            className="juke-ring-btn mt-4 h-11 px-5"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="juke-shell min-h-screen px-3 py-4">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="juke-checkout-chip active inline-flex items-center gap-2 text-xs font-semibold h-10 px-4 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <section className="juke-register p-4 rounded-lg">
          <div className="flex flex-wrap justify-between gap-3 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-black/65">
                Route 66 Tracker
              </p>
              <h1 className="juke-item-title text-4xl">
                Order #{order.order_number || order.id}
              </h1>
              <p className="text-black/70">
                Status:{" "}
                <span className="font-semibold capitalize">{order.status}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs uppercase tracking-wide px-2 py-1 border ${isConnected ? "border-green-600 text-green-700" : "border-black/30"}`}
              >
                {isConnected && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 mr-1 animate-pulse" />
                )}
                {isConnected ? "Live" : "Polling"}
              </span>
              <button
                aria-label="Refresh order status"
                onClick={() => loadOrder(true)}
                className="juke-checkout-btn h-10 px-3 text-xs inline-flex items-center gap-1"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />{" "}
                Refresh
              </button>
            </div>
          </div>

          <div className="juke-route mt-4 rounded-md p-4">
            <div className="juke-route-line">
              <span
                className="juke-route-car"
                style={{ left: `${routePercent}%` }}
              >
                <CarFront className="w-6 h-6 text-red-700" />
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {DISPLAY_STEPS.map((step, idx) => {
                const isActive = idx === activeIdx;
                const isDone = idx < activeIdx;
                return (
                  <div
                    key={step.label}
                    className={`border p-2 rounded-sm ${isActive ? "border-red-700 bg-red-50" : isDone ? "border-black/40 bg-black/5" : "border-black/20 bg-white/70"}`}
                  >
                    <p className="text-xs uppercase tracking-wide">
                      Stop {idx + 1}
                    </p>
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-black/60 mt-1">
                      {isActive
                        ? "Current stop"
                        : isDone
                          ? "Passed"
                          : "Coming up"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 juke-ticket-card p-3 text-sm font-mono">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${(order.tax || 0).toFixed(2)}</span>
            </div>
            {(order.tip || 0) > 0 && (
              <div className="flex justify-between">
                <span>Tip</span>
                <span>${(order.tip || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="h-px bg-white/30 my-1" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${(order.total || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() =>
                window.open(
                  `/order-confirmation?orderId=${encodeURIComponent(orderId)}`,
                  "_blank",
                )
              }
              className="juke-checkout-btn h-11 text-xs"
            >
              View confirmation
            </button>
            <button
              onClick={() => navigate("/")}
              className="juke-checkout-btn active h-11 text-xs"
            >
              Start another order
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default JukeboxOrderTrackingPage;
