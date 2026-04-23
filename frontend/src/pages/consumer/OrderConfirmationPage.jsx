import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Check, Sparkles, Home, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const OrderConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const merchantSlug = searchParams.get("merchantSlug");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) {
      navigate("/");
    }
  }, [orderId, navigate]);

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    toast.success("Order ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToMenu = () => {
    const menuUrl = `/merchant/${merchantSlug}`;
    if (window.opener) {
      window.opener.location.href = window.location.origin + menuUrl;
      window.close();
    } else {
      navigate(menuUrl);
    }
  };

  if (!orderId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="text-center pb-4">
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-green-400" />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-2"
            >
              Thank You!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-zinc-400"
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
              className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
            >
              <p className="text-sm text-zinc-400 mb-2">Order ID</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xl font-mono font-semibold text-orange-400 break-all">
                  {orderId}
                </p>
                <Button
                  onClick={handleCopyOrderId}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 hover:bg-zinc-700"
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
              className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
            >
              <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                Please save your Order ID for reference. The restaurant has
                received your order and will begin preparation shortly.
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3"
            >
              {/* Back to Menu Button */}
              {merchantSlug && (
                <Button
                  onClick={handleBackToMenu}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Back to Menu
                </Button>
              )}
            </motion.div>
          </CardContent>
        </Card>

        {/* Confetti-like decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6 text-zinc-500 text-sm"
        >
          Order placed at {new Date().toLocaleTimeString()}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OrderConfirmationPage;
