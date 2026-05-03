import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Copy, Disc3, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useJukeboxTheme } from "./JukeboxTheme";
import { apiService } from "../../context/AppContext";
import { getOrderHandoffCopy } from "../../lib/orderHandoff";

const JukeboxOrderConfirmationPage = () => {
  useJukeboxTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  const orderId = searchParams.get("orderId") || "";
  const merchantSlug = searchParams.get("merchantSlug") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";

  const paymentMethodLabelMap = {
    demo_card: "Demo Credit Card",
    cash: "Cash",
    pay_at_store: "Pay at Store",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  const paymentMethodLabel = paymentMethodLabelMap[paymentMethod] || "";

  const trackingLink = useMemo(
    () => `${window.location.origin}/track/${orderId}`,
    [orderId],
  );

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    apiService
      .getOrderPublic(orderId, { _ts: Date.now() })
      .then((res) => {
        if (!cancelled) setOrderDetails(res.data);
      })
      .catch(() => {
        if (!cancelled) setOrderDetails(null);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handoff = getOrderHandoffCopy({
    deliveryType: orderDetails?.delivery_type,
    customerName: orderDetails?.customer?.name,
    customerPhone: orderDetails?.customer?.phone,
  });

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("Order reference copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Unable to copy order ID");
    }
  };

  const shareTracking = async () => {
    const data = {
      title: "Track my order",
      text: `Track order ${orderId}`,
      url: trackingLink,
    };

    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // Ignore cancel.
      }
      return;
    }

    await navigator.clipboard.writeText(trackingLink);
    toast.success("Tracking link copied");
  };

  if (!orderId) {
    return (
      <div className="juke-shell min-h-screen px-3 py-10">
        <div className="max-w-xl mx-auto juke-register p-6 rounded-lg text-center">
          <p className="text-2xl juke-item-title">No ticket found</p>
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
    <div className="juke-shell min-h-screen px-3 py-8">
      <div className="max-w-2xl mx-auto">
        <section className="juke-register p-5 rounded-lg text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-black/65">
            Deli Ticket Confirmation
          </p>
          <CheckCircle2 className="w-14 h-14 mx-auto mt-2" />
          <h1 className="juke-item-title text-5xl mt-2">
            You&apos;re the Boss, Applesauce!
          </h1>
          <p className="text-black/70 mt-1">
            Thanks for ordering. The grill is already moving on your ticket.
          </p>

          <div className="juke-ticket-card mt-5 p-4 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-white/75">
                Handoff
              </p>
              <Disc3 className="w-5 h-5 text-white/90" />
            </div>
            <p className="mt-2 text-base font-semibold">{handoff.title}</p>
            <p className="text-xs text-white/75 mt-2">{handoff.detail}</p>
            {paymentMethodLabel && (
              <p className="text-xs uppercase tracking-wide text-white/85 mt-3">
                Payment: {paymentMethodLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => window.open(`/track/${orderId}`, "_blank")}
              className="juke-checkout-btn active h-11 text-xs"
            >
              Track order
            </button>
            <button
              onClick={() =>
                navigate(merchantSlug ? `/order/${merchantSlug}` : "/")
              }
              className="juke-checkout-btn h-11 text-xs"
            >
              Back to menu
            </button>
            <button
              onClick={copyOrderId}
              className="juke-checkout-btn h-11 text-xs inline-flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy reference"}
            </button>
            <button
              onClick={shareTracking}
              className="juke-checkout-btn h-11 text-xs inline-flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default JukeboxOrderConfirmationPage;
