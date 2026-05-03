import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Check, Sparkles, Copy, CheckCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const OrderConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const merchantSlug = searchParams.get("merchantSlug");
  const paymentMethod = searchParams.get("paymentMethod") || "";
  const [copied, setCopied] = useState(false);
  // Capture the placed-at time once on mount so it doesn't change on re-renders
  const placedAtRef = useRef(new Date().toLocaleTimeString());

  useEffect(() => {
    if (!orderId) {
      navigate("/", { replace: true });
    }
  }, [orderId, navigate]);

  const paymentMethodLabelMap = {
    demo_card: "Demo Credit Card",
    cash: "Cash",
    pay_at_store: "Pay at Store",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  const paymentMethodLabel = paymentMethodLabelMap[paymentMethod] || "";

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    toast.success("Order ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToMenu = () => {
    navigate(merchantSlug ? `/order/${merchantSlug}` : "/");
  };

  const handleTrackOrder = () => {
    window.open(`/track/${encodeURIComponent(orderId)}`, "_blank");
  };

  if (!orderId) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen consumer-theme-shell flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="consumer-theme-panel-strong">
          <CardHeader className="text-center pb-4">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center consumer-theme-accent-soft">
                <Check className="w-10 h-10 text-green-400" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-2"
            >
              Thank You!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="consumer-theme-muted"
            >
              Your order has been placed successfully
            </motion.p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Order ID Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 consumer-theme-panel rounded-xl"
            >
              <p className="text-sm consumer-theme-muted mb-2">Order Reference</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl font-mono font-semibold consumer-theme-accent break-all">
                  {orderId}
                </p>
                <Button
                  onClick={handleCopyOrderId}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 consumer-theme-icon-button"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Info Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-start gap-3 p-4 consumer-theme-accent-soft border rounded-xl"
            >
              <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                Please save your Order ID for reference. The restaurant has
                received your order and will begin preparation shortly.
              </div>
            </motion.div>

            {paymentMethodLabel && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="p-3 consumer-theme-panel rounded-xl text-sm"
              >
                <span className="consumer-theme-muted">Payment: </span>
                <span className="font-medium">
                  {paymentMethodLabel}
                </span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3"
            >
              <Button
                onClick={handleTrackOrder}
                className="w-full consumer-theme-button h-12 text-base"
              >
                Track Order
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {merchantSlug && (
                <button
                  onClick={handleBackToMenu}
                  className="w-full text-sm consumer-theme-icon-button py-2 transition-colors"
                >
                  Back to Menu
                </button>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Confetti-like decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6 consumer-theme-muted text-sm"
        >
          Order placed at {placedAtRef.current}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OrderConfirmationPage;
