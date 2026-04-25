import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
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

/* Simple QR placeholder rendered as SVG grid */
const QrPlaceholder = ({ value }) => {
  // 7×7 finder pattern mock — decorative only
  const cells = useMemo(() => {
    const grid = [];
    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        // outer finder patterns
        const inFinder =
          (r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7);
        // deterministic fill based on value hash
        const charCode =
          value?.charCodeAt((r * 21 + c) % (value?.length || 1)) || 0;
        const filled = inFinder || (charCode + r + c) % 3 !== 0;
        grid.push({ r, c, filled });
      }
    }
    return grid;
  }, [value]);

  return (
    <svg
      viewBox="0 0 21 21"
      className="w-28 h-28"
      aria-label="QR Code placeholder"
    >
      {cells.map(({ r, c, filled }) =>
        filled ? (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            fill="#111"
          />
        ) : null,
      )}
    </svg>
  );
};

/* ─── Order Confirmation Page ─────────────────────────────── */
const VelocityOrderConfirmationPage = () => {
  useVelocityTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

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

  const shortId = useMemo(() => {
    if (!orderId) return "";
    // Show last 8 chars if it's a long UUID, else show full
    return orderId.length > 12
      ? orderId.slice(-8).toUpperCase()
      : orderId.toUpperCase();
  }, [orderId]);

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

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-black/50 font-semibold">Missing order details.</p>
        <button
          onClick={() => navigate("/")}
          className="h-12 px-8 rounded-2xl vel-accent-bg font-bold"
        >
          Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4] flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="w-full max-w-sm text-center"
      >
        {/* success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.1,
            type: "spring",
            damping: 16,
            stiffness: 300,
          }}
          className="flex justify-center mb-6"
        >
          <CheckCircle2
            className="w-16 h-16"
            style={{ color: "var(--vel-accent)" }}
          />
        </motion.div>

        {/* order number — massive */}
        <p className="text-xs font-black uppercase tracking-[0.22em] text-black/40 mb-2">
          Order Confirmed
        </p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-7xl font-black leading-none tracking-tighter text-[#111] cursor-pointer"
          onClick={handleCopy}
          title="Tap to copy order ID"
        >
          #{shortId}
        </motion.h1>
        <p className="text-sm text-black/40 mt-2">
          {copied ? "Copied!" : "Tap number to copy full ID"}
        </p>

        {/* ETA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mt-8 bg-white rounded-2xl p-5 shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-widest text-black/35 mb-1">
            Estimated Ready
          </p>
          <p className="text-4xl font-black text-[#111]">~15 min</p>
          <p className="text-xs text-black/40 mt-1">
            We'll have your order ready soon
          </p>

          {/* QR placeholder */}
          <div className="flex justify-center mt-4">
            <div className="bg-white border-2 border-[#eee] rounded-xl p-3 inline-block">
              <QrPlaceholder value={orderId} />
            </div>
          </div>
          <p className="text-xs text-black/30 mt-2">Show this code at pickup</p>

          {paymentMethodLabel && (
            <p className="text-xs text-black/40 mt-3">
              Payment:{" "}
              <span className="font-bold text-black/70">
                {paymentMethodLabel}
              </span>
            </p>
          )}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 space-y-3"
        >
          <button
            type="button"
            onClick={() => navigate(`/track/${encodeURIComponent(orderId)}`)}
            className="w-full h-14 rounded-2xl vel-accent-bg font-black text-base flex items-center justify-center gap-2"
          >
            Track Order
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() =>
              navigate(merchantSlug ? `/order/${merchantSlug}` : "/")
            }
            className="w-full text-sm font-semibold text-black/50 hover:text-black/80 py-2 transition-colors"
          >
            Back to Menu
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default VelocityOrderConfirmationPage;
