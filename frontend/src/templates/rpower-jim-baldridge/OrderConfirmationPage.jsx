import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CheckCircle2, Copy, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  getPersistedRpowerJimBaldridgeLegacyMode,
  persistRpowerJimBaldridgeLegacyMode,
  useRpowerJimBaldridgeTheme,
} from "./Theme";
import LegacyLockup from "./LegacyLockup";

const RpowerJimBaldridgeOrderConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [legacyMode, setLegacyMode] = useState(
    getPersistedRpowerJimBaldridgeLegacyMode(),
  );
  const orderId = searchParams.get("orderId") || "";
  const merchantSlug = searchParams.get("merchantSlug") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";

  useRpowerJimBaldridgeTheme(legacyMode);

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
    if (!merchantSlug) {
      setLegacyMode(getPersistedRpowerJimBaldridgeLegacyMode());
      return;
    }

    let cancelled = false;
    const loadMerchantThemeMode = async () => {
      try {
        const merchantRes = await apiService.getMerchantBySlug(merchantSlug);
        const enabled = Boolean(
          merchantRes.data?.shepherd_config?.rjb_legacy_mode,
        );
        if (!cancelled) {
          setLegacyMode(enabled);
          persistRpowerJimBaldridgeLegacyMode(enabled);
        }
      } catch {
        if (!cancelled) {
          setLegacyMode(getPersistedRpowerJimBaldridgeLegacyMode());
        }
      }
    };

    loadMerchantThemeMode();
    return () => {
      cancelled = true;
    };
  }, [merchantSlug]);

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
      <div className="min-h-screen bg-[#0f1115] px-6 py-12 text-white">
        <div className="max-w-2xl mx-auto rjb-surface p-10 text-center">
          <h1 className="text-2xl font-light">Missing order details</h1>
          <Button className="mt-4 rounded-full" onClick={() => navigate("/")}>
            Back Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] px-6 py-12 text-white">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rjb-surface p-8 md:p-10 text-center"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-[#f6c453]/80">
            RPOWER Legacy Receipt
          </p>
          <CheckCircle2 className="w-16 h-16 text-[#f6c453] mx-auto mt-2" />
          <h1 className="mt-5 text-4xl md:text-5xl font-light tracking-wide">
            Thank You
          </h1>
          <p className="mt-3 text-white/65">
            Your order is confirmed and has been sent to the kitchen.
          </p>
          <LegacyLockup className="mt-3" compact />

          <div className="mt-7 p-4 rounded-2xl bg-black/30 border border-[#f6c45333]">
            <p className="text-xs uppercase tracking-[0.14em] text-white/50">
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
            <Badge variant="outline" className="rjb-pill px-3 py-1">
              Legacy Theme
            </Badge>
            <Badge variant="outline" className="rjb-pill px-3 py-1">
              Ready for Tracking
            </Badge>
            {paymentMethodLabel && (
              <Badge variant="outline" className="rjb-pill px-3 py-1">
                {paymentMethodLabel}
              </Badge>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="rounded-full bg-[#d72638] hover:bg-[#bd1f2f]"
              onClick={() => navigate(`/track/${orderId}`)}
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

export default RpowerJimBaldridgeOrderConfirmationPage;
