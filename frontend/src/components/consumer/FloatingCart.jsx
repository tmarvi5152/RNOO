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
                consumer-theme-panel-strong rounded-full
                shadow-2xl shadow-black/50
                hover:shadow-black/60
                transition-all duration-300 cursor-pointer
                ${recentlyAdded ? "animate-pulse" : ""}
              `}
              style={
                recentlyAdded
                  ? { boxShadow: "0 0 0 2px var(--theme-app-accent)" }
                  : undefined
              }
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Glow Effect */}
              <div
                className="absolute inset-0 rounded-full blur-xl opacity-50"
                style={{
                  background:
                    "color-mix(in srgb, var(--theme-app-accent) 14%, transparent)",
                }}
              />

              <motion.div
                className="relative flex items-center justify-center w-8 h-8 rounded-full consumer-theme-accent-bg"
                animate={recentlyAdded ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center consumer-theme-panel consumer-theme-accent">
                  {itemCount}
                </span>
              </motion.div>

              <div className="flex flex-col items-start">
                <span className="text-xs consumer-theme-muted uppercase tracking-wider">
                  Your Order
                </span>
                <span className="font-semibold">${total.toFixed(2)}</span>
              </div>

              <ChevronRight className="w-4 h-4 consumer-theme-muted ml-1" />
            </motion.button>
          ) : (
            /* Expanded State */
            <motion.div
              key="expanded"
              layoutId="cart-container"
              className="
                w-[250px] max-h-[68vh]
                consumer-theme-panel-strong backdrop-blur-xl rounded-2xl
                shadow-2xl shadow-black/50
                overflow-hidden
              "
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-3 border-b"
                style={{ borderColor: "var(--theme-app-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full consumer-theme-accent-bg">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Your Order</h3>
                    <p className="text-xs consumer-theme-muted">
                      {itemCount} item{itemCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-full consumer-theme-icon-button"
                >
                  <X className="w-4 h-4" />
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
                        relative p-2.5 consumer-theme-panel rounded-xl
                        transition-colors
                      "
                    >
                      <div className="flex gap-3">
                        {/* Item Image */}
                        {hasValidImage(item) ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden consumer-theme-panel-strong flex-shrink-0">
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
                          <div className="w-10 h-10 rounded-lg consumer-theme-accent-soft flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">
                            {item.name}
                          </h4>
                          {item.modifiers?.length > 0 && (
                            <p className="text-[11px] consumer-theme-muted truncate">
                              {item.modifiers
                                .map((m) => m.option_name)
                                .join(", ")}
                            </p>
                          )}
                          <p className="text-sm font-semibold mt-0.5 consumer-theme-accent">
                            ${item.totalPrice.toFixed(2)}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full transition-colors group consumer-theme-icon-button"
                        >
                          <Trash2 className="w-3.5 h-3.5 group-hover:text-red-400" />
                        </button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-end mt-2 gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full consumer-theme-button-secondary"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center rounded-full consumer-theme-button-secondary"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Summary */}
              <div
                className="p-3 border-t space-y-2"
                style={{ borderColor: "var(--theme-app-border)" }}
              >
                <div className="flex justify-between text-sm">
                  <span className="consumer-theme-muted">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="consumer-theme-muted">Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div
                  className="flex justify-between text-sm font-semibold pt-2 border-t"
                  style={{ borderColor: "var(--theme-app-border)" }}
                >
                  <span>Total</span>
                  <span className="consumer-theme-accent">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <motion.button
                  onClick={() => {
                    setIsExpanded(false);
                    navigate(`/checkout/${merchantSlug}`);
                  }}
                  className="
                    w-full py-2.5 mt-2
                    consumer-theme-button
                    text-sm font-semibold rounded-xl
                    shadow-lg shadow-black/20
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
