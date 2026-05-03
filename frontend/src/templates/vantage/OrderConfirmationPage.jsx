import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CheckCircle2, Copy, Share2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useVantageTheme } from "./VantageTheme";
import { apiService } from "../../context/AppContext";
import { getOrderHandoffCopy } from "../../lib/orderHandoff";

const VantageOrderConfirmationPage = () => {
  useVantageTheme();
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

  const trackingLink = useMemo(() => {
    return `${window.location.origin}/track/${orderId}`;
  }, [orderId]);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("Order ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: "My RNOO Order",
      text: `Track my order: ${orderId}`,
      url: trackingLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // ignore cancel
      }
      return;
    }
    await navigator.clipboard.writeText(trackingLink);
    toast.success("Tracking link copied");
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#f8f8f5] px-6 py-12">
        <div className="max-w-2xl mx-auto vantage-surface p-10 text-center">
          <h1 className="text-2xl font-light">Missing order details</h1>
          <Button className="mt-4 rounded-full" onClick={() => navigate("/")}>
            Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,_#fdfbf6_0%,_#f2ede3_55%,_#e8dfcf_100%)] px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="vantage-surface p-8 md:p-10 text-center shadow-[0_20px_55px_rgba(20,20,20,0.1)]"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-black/50">
            Vantage Receipt
          </p>
          <CheckCircle2 className="w-16 h-16 text-black mx-auto" />
          <h1 className="mt-5 text-4xl md:text-5xl font-light tracking-wide">
            Thank You
          </h1>
          <p className="mt-3 text-black/65">
            Your order is confirmed and has been sent to the kitchen.
          </p>

          <div className="mt-4 p-4 rounded-2xl bg-white/70 border border-black/10 text-left">
            <p className="text-sm font-semibold">{handoff.title}</p>
            <p className="text-xs text-black/65 mt-1">{handoff.detail}</p>
          </div>

          <div className="mt-7 p-4 rounded-2xl bg-[linear-gradient(120deg,_rgba(255,255,255,0.8)_0%,_rgba(246,239,227,0.85)_100%)] border border-black/10">
            <p className="text-xs uppercase tracking-[0.14em] text-black/50">
              Order ID
            </p>
            <p className="text-xl font-mono mt-2 break-all">{orderId}</p>
            <Button
              variant="outline"
              className="mt-3 rounded-full"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied" : "Copy ID"}
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="vantage-pill px-3 py-1">
              Vantage Receipt
            </Badge>
            <Badge variant="outline" className="vantage-pill px-3 py-1">
              Ready for Tracking
            </Badge>
            {paymentMethodLabel && (
              <Badge variant="outline" className="vantage-pill px-3 py-1">
                {paymentMethodLabel}
              </Badge>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="rounded-full"
              onClick={() => window.open(`/track/${orderId}`, "_blank")}
            >
              Track Order
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                navigate(merchantSlug ? `/order/${merchantSlug}` : "/")
              }
            >
              Back to Menu
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                window.location.href = `mailto:?subject=RNOO Order ${orderId}&body=Track my order: ${trackingLink}`;
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VantageOrderConfirmationPage;
