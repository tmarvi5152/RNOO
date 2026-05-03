import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useCraveTheme } from "./CraveTheme";
import { apiService } from "../../context/AppContext";
import { getOrderHandoffCopy } from "../../lib/orderHandoff";

const CraveOrderConfirmationPage = () => {
  useCraveTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get("orderId") || "";
  const merchantSlug = searchParams.get("merchantSlug") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";
  const [orderDetails, setOrderDetails] = useState(null);

  const paymentMethodLabelMap = {
    demo_card: "Demo Credit Card",
    cash: "Cash",
    pay_at_store: "Pay at Store",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  const paymentMethodLabel = paymentMethodLabelMap[paymentMethod] || "";

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

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[var(--crv-bg)] flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-slate-500">Missing order details.</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="h-12 px-8 rounded-full bg-[var(--crv-accent)] text-white font-bold"
        >
          Back Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,#ffe4e6_0%,#f8fafc_36%)] px-4 lg:px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 lg:p-8 lg:grid lg:grid-cols-[1fr_0.9fr] lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ scale: 0.8, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 16, stiffness: 260 }}
              className="mx-auto lg:mx-0 mb-3 w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center"
            >
              <CheckCircle2 className="w-12 h-12 text-[var(--crv-accent)]" />
            </motion.div>

            <p className="text-xs uppercase tracking-[0.2em] font-bold text-slate-400">
              Order Confirmed
            </p>
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mt-1">
              We've got it!
            </h1>
            <p className="text-sm text-slate-500 mt-2">{handoff.title}</p>
            {paymentMethodLabel && (
              <p className="text-xs text-slate-400 mt-1">
                Payment:{" "}
                <span className="font-semibold text-slate-600">
                  {paymentMethodLabel}
                </span>
              </p>
            )}

            <div className="mt-5 rounded-2xl bg-red-50 border border-red-100 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                {orderDetails?.delivery_type === "DELIVERY"
                  ? "Delivery Handoff"
                  : "Pickup Handoff"}
              </p>
              <p className="text-sm font-semibold text-slate-800 flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-red-500" />
                {handoff.title}. {handoff.detail}
              </p>
            </div>
          </div>

          <div className="mt-6 lg:mt-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Next Step
              </p>
              <p className="text-sm text-slate-700 mt-1">
                Follow live preparation updates and call the restaurant if you
                need help.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() =>
                  window.open(`/track/${encodeURIComponent(orderId)}`, "_blank")
                }
                className="w-full h-12 rounded-full bg-[var(--crv-accent)] text-white font-bold inline-flex items-center justify-center gap-2"
              >
                Track Order
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(merchantSlug ? `/order/${merchantSlug}` : "/")
                }
                className="w-full h-11 rounded-full border border-slate-300 text-sm text-slate-600 hover:text-slate-800"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CraveOrderConfirmationPage;
