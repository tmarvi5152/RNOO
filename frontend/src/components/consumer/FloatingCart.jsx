import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const FloatingCart = ({ merchantSlug }) => {
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  const hasValidImage = (item) => Boolean(item.image && !failedImages[item.id]);

  // Pulse animation when item is added
  useEffect(() => {
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      setRecentlyAdded(lastItem.id);
      const timer = setTimeout(() => setRecentlyAdded(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [items]);

  if (itemCount === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Floating Island */}
      <motion.div
        layout
        className="fixed bottom-4 right-4 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            /* Collapsed State */
            <motion.button
              key="collapsed"
              layoutId="cart-container"
              onClick={() => setIsExpanded(true)}
              className={`
                relative flex items-center gap-2 px-3.5 py-2
                bg-gradient-to-r from-zinc-900 to-zinc-800
                border border-white/10 rounded-full
                shadow-2xl shadow-black/50
                hover:border-orange-500/50 hover:shadow-orange-500/20
                transition-all duration-300 cursor-pointer
                ${recentlyAdded ? "animate-pulse ring-2 ring-orange-500" : ""}
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-full bg-orange-500/10 blur-xl opacity-50" />

              <motion.div
                className="relative flex items-center justify-center w-8 h-8 bg-orange-500 rounded-full"
                animate={recentlyAdded ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <ShoppingBag className="w-4 h-4 text-white" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-orange-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                  {itemCount}
                </span>
              </motion.div>

              <div className="flex flex-col items-start">
                <span className="text-xs text-zinc-400 uppercase tracking-wider">
                  Your Order
                </span>
                <span className="text-white font-semibold">
                  ${total.toFixed(2)}
                </span>
              </div>

              <ChevronRight className="w-4 h-4 text-zinc-400 ml-1" />
            </motion.button>
          ) : (
            /* Expanded State */
            <motion.div
              key="expanded"
              layoutId="cart-container"
              className="
                w-[250px] max-h-[68vh]
                bg-zinc-900/95 backdrop-blur-xl
                border border-white/10 rounded-2xl
                shadow-2xl shadow-black/50
                overflow-hidden
              "
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-500 rounded-full">
                    <ShoppingBag className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-semibold">Your Order</h3>
                    <p className="text-xs text-zinc-400">
                      {itemCount} item{itemCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* Items */}
              <div className="max-h-[34vh] overflow-y-auto p-2.5 space-y-2">
                <AnimatePresence>
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      className="
                        relative p-2.5 bg-white/5 rounded-xl
                        border border-white/5
                        hover:border-white/10 transition-colors
                      "
                    >
                      <div className="flex gap-3">
                        {/* Item Image */}
                        {hasValidImage(item) ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() =>
                                setFailedImages((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-orange-400" />
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-sm font-medium truncate">
                            {item.name}
                          </h4>
                          {item.modifiers?.length > 0 && (
                            <p className="text-[11px] text-zinc-400 truncate">
                              {item.modifiers
                                .map((m) => m.option_name)
                                .join(", ")}
                            </p>
                          )}
                          <p className="text-orange-400 text-sm font-semibold mt-0.5">
                            ${item.totalPrice.toFixed(2)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-1.5 right-1.5 p-1 hover:bg-red-500/20 rounded-full transition-colors group"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-400" />
                        </button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-end mt-2 gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                          <Minus className="w-3 h-3 text-white" />
                        </button>
                        <span className="text-white text-sm font-medium w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Summary */}
              <div className="p-3 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Subtotal</span>
                  <span className="text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Tax</span>
                  <span className="text-white">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/10">
                  <span className="text-white">Total</span>
                  <span className="text-orange-400">${total.toFixed(2)}</span>
                </div>

                <motion.button
                  onClick={() => {
                    setIsExpanded(false);
                    navigate(`/checkout/${merchantSlug}`);
                  }}
                  className="
                    w-full py-2.5 mt-2
                    bg-gradient-to-r from-orange-500 to-orange-600
                    hover:from-orange-400 hover:to-orange-500
                    text-sm text-white font-semibold rounded-xl
                    shadow-lg shadow-orange-500/25
                    flex items-center justify-center gap-2
                    transition-all duration-300
                  "
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Sparkles className="w-4 h-4" />
                  Checkout
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default FloatingCart;
