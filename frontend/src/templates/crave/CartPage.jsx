import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

const CRAVE_STYLES = `
  :root {
    --crv-accent: #ef4444;
    --crv-bg: #f8fafc;
    --crv-border: #e5e7eb;
  }
`;

function useCraveTheme() {
  useEffect(() => {
    const id = "crave-theme";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CRAVE_STYLES;
      document.head.appendChild(el);
    }
  }, []);
}

const CraveCartPage = () => {
  useCraveTheme();
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
      <div className="min-h-screen bg-[var(--crv-bg)] flex flex-col items-center justify-center px-6 gap-4">
        <ShoppingBag className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-800">Your cart is empty</h2>
        <button
          type="button"
          onClick={() => navigate(`/order/${slug}`)}
          className="h-12 px-8 rounded-full bg-[var(--crv-accent)] text-white font-bold"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#ffe4e6_0%,#f8fafc_36%)]">
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[var(--crv-border)] h-14 px-4 lg:px-6 flex items-center gap-3">
        <div className="max-w-6xl mx-auto w-full flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/order/${slug}`)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-bold text-lg text-slate-800 flex-1">Your Cart</h1>
          <p className="hidden lg:block text-sm text-slate-500">
            {itemCount} item{itemCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-5 grid lg:grid-cols-[1fr_360px] gap-5 pb-32 lg:pb-10">
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-slate-200 p-3 lg:p-4 flex gap-3"
              >
                {item.image && !failedImages[item.id] ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                    }
                    className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl object-cover bg-slate-100"
                  />
                ) : (
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-slate-100" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-slate-800 truncate">
                        {item.name}
                      </p>
                      {item.modifiers?.length > 0 && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.modifiers.map((m) => m.option_name).join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-1 py-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      ${item.totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Summary</h2>
            <div className="text-sm space-y-1 mt-3 mb-4">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/checkout/${slug}`)}
              className="w-full h-12 rounded-full bg-[var(--crv-accent)] text-white font-bold"
            >
              Proceed to Checkout
            </button>
          </div>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--crv-border)] p-4 lg:hidden">
        <div className="max-w-2xl mx-auto">
          <div className="text-sm space-y-1 mb-3">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/checkout/${slug}`)}
            className="w-full h-12 rounded-full bg-[var(--crv-accent)] text-white font-bold"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

export default CraveCartPage;
