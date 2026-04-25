import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from "lucide-react";

/* Inject velocity theme variables (idempotent) */
const VELOCITY_STYLES = `
  :root {
    --vel-accent: #ff4405;
    --vel-accent-light: #fff1ed;
    --vel-bg: #f4f4f4;
    --vel-card: #ffffff;
    --vel-border: #e8e8e8;
    --vel-text: #111111;
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

const VelocityCartPage = () => {
  useVelocityTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    items,
    getItemCount,
    getSubtotal,
    getTax,
    getTotal,
    updateQuantity,
    removeItem,
  } = useCartStore();

  const [failedImages, setFailedImages] = useState({});

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] flex flex-col items-center justify-center px-6 gap-5">
        <ShoppingBag className="w-16 h-16 text-black/20" />
        <h2 className="text-xl font-black">Your bag is empty</h2>
        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="h-12 px-8 rounded-2xl vel-accent-bg font-bold text-base"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className="min-h-screen bg-[#f4f4f4] flex flex-col"
    >
      {/* header */}
      <div className="bg-white border-b border-[#eee] px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => navigate(`/order/${slug}`)}
          className="w-9 h-9 rounded-full bg-[#f4f4f4] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-black text-xl flex-1">Your Bag</h1>
        <span className="text-sm font-semibold text-black/50">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* items */}
      <div className="flex-1 px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        <AnimatePresence>
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white rounded-2xl p-4 flex gap-3 shadow-sm"
            >
              {item.image && !failedImages[item.id] ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 rounded-xl object-cover bg-[#f0f0f0] shrink-0"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                  }
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-[#f0f0f0] shrink-0 flex items-center justify-center">
                  <ShoppingBag className="w-7 h-7 text-black/25" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight">
                      {item.name}
                    </p>
                    {item.modifiers?.length > 0 && (
                      <p className="text-xs text-black/50 mt-0.5 line-clamp-1">
                        {item.modifiers.map((m) => m.option_name).join(", ")}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-xs italic text-black/40 mt-0.5 line-clamp-1">
                        "{item.specialInstructions}"
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-black/30 hover:text-red-500 transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  {/* quantity stepper */}
                  <div className="inline-flex items-center gap-1 bg-[#f4f4f4] rounded-full px-1 py-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-sm">
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* summary + CTA */}
      <div className="bg-white border-t border-[#eee] px-4 pt-4 pb-6 max-w-2xl w-full mx-auto">
        <div className="space-y-1.5 text-sm mb-4">
          <div className="flex justify-between text-black/60">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-black/60">
            <span>Tax (8.25%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-black text-base mt-1 pt-1 border-t border-[#eee]">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/checkout/${slug}`)}
          className="w-full h-14 rounded-2xl vel-accent-bg font-black text-lg tracking-wide active:scale-[0.98] transition-transform"
        >
          Go to Checkout — ${total.toFixed(2)}
        </button>
      </div>
    </motion.div>
  );
};

export default VelocityCartPage;
