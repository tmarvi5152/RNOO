import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import RpowerOriginalHeroBanner from "./HeroBanner";
import { apiService } from "../../context/AppContext";
import { getOrderHandoffCopy } from "../../lib/orderHandoff";

const PAYMENT_LABELS = {
  demo_card: "Demo Credit Card",
  cash: "Cash",
  pay_at_store: "Pay at Store",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

const RpowerOriginalOrderConfirmationPage = () => {
  useRpowerOriginalTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [posTicket, setPosTicket] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);

  const orderId = searchParams.get("orderId") || "";
  const merchantSlug = searchParams.get("merchantSlug") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || "";

  const placedAt = useRef(new Date());

  // Poll for POS ticket number until it appears (RPOWER assigns it 15-20s after submission)
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await apiService.getOrderPublic(orderId);
        if (!cancelled) {
          setOrderDetails(res?.data || null);
        }
        const ticket = res?.data?.poscnx_ticket_number;
        if (ticket && !cancelled) {
          setPosTicket(ticket);
        }
      } catch {
        /* silent */
      }
    };

    check();
    const id = setInterval(() => {
      if (posTicket) {
        clearInterval(id);
        return;
      }
      check();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [orderId, posTicket]);

  const trackingLink = useMemo(
    () => `${window.location.origin}/track/${orderId}`,
    [orderId],
  );

  useEffect(() => {
    if (!orderId) navigate("/", { replace: true });
  }, [orderId, navigate]);

  if (!orderId) return null;

  const handoff = getOrderHandoffCopy({
    deliveryType: orderDetails?.delivery_type,
    customerName: orderDetails?.customer?.name,
    customerPhone: orderDetails?.customer?.phone,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("Order reference copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "My RPOWER Order",
      text: `Track my order: ${orderId}`,
      url: trackingLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* dismissed */
      }
      return;
    }
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Tracking link copied");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "transparent" }}
    >
      <RpowerOriginalHeroBanner title="Order Confirmed" compact />

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Success banner */}
          <div
            className="ro-panel overflow-hidden mb-4"
            style={{ borderTop: "4px solid var(--ro-red)" }}
          >
            <div className="text-center px-6 py-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(211, 173, 103, 0.16)" }}
              >
                <CheckCircle2
                  className="w-9 h-9"
                  style={{ color: "var(--ro-red)" }}
                />
              </div>
              <h1
                className="text-2xl font-bold mb-1"
                style={{ color: "#f8fafc" }}
              >
                Order Confirmed!
              </h1>
              <p className="text-sm" style={{ color: "#cbd5e1" }}>
                Your order has been received and sent to the kitchen.
              </p>
            </div>

            {/* Handoff details */}
            <div
              className="px-6 py-5 text-center"
              style={{
                background: "rgba(2, 6, 23, 0.45)",
                borderTop: "1px solid rgba(255,255,255,0.16)",
                borderBottom: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              <p className="ro-label mb-2">Handoff</p>
              <p
                className="text-xl font-bold mb-1"
                style={{ color: "#f8fafc" }}
              >
                {handoff.title}
              </p>
              <p className="text-sm mb-3" style={{ color: "#cbd5e1" }}>
                {handoff.detail}
              </p>
              {posTicket && (
                <p className="text-sm mb-3" style={{ color: "#cbd5e1" }}>
                  POS Ticket&nbsp;
                  <span
                    className="font-bold"
                    style={{ color: "var(--ro-red)" }}
                  >
                    #{posTicket}
                  </span>
                </p>
              )}
              <button
                onClick={handleCopy}
                className="ro-btn-outline inline-flex items-center gap-2 px-4 py-2 text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied!" : "Copy Order Reference"}
              </button>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold" style={{ color: "#f8fafc" }}>
                  Placed At
                </span>
                <span style={{ color: "#cbd5e1" }}>
                  {placedAt.current.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {paymentLabel && (
                <div className="flex justify-between text-sm">
                  <span className="font-semibold" style={{ color: "#f8fafc" }}>
                    Payment
                  </span>
                  <span style={{ color: "#cbd5e1" }}>{paymentLabel}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="ro-panel p-5 space-y-3">
            <button
              className="ro-btn-primary w-full py-3 text-sm"
              onClick={() => window.open(`/track/${orderId}`, "_blank")}
            >
              Track My Order
            </button>
            <button
              className="ro-btn-outline w-full py-2.5 text-sm"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
              Share Tracking Link
            </button>
            <button
              className="ro-btn-ghost w-full justify-center py-2.5 text-sm"
              onClick={() =>
                navigate(merchantSlug ? `/order/${merchantSlug}` : "/")
              }
            >
              Back to Menu
            </button>
          </div>

          <p className="text-xs text-center mt-4" style={{ color: "#94a3b8" }}>
            Powered by RPOWER POS · Keep your order reference for support
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RpowerOriginalOrderConfirmationPage;
