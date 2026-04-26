import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import RpowerOriginalHeroBanner from "./HeroBanner";

const RpowerOriginalCartPage = () => {
  useRpowerOriginalTheme();
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

  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const tax = getTax();
  const total = getTotal();

  const [failedImages, setFailedImages] = useState({});

  // ── Empty state ──────────────────────────────────────────────────────────
  if (itemCount === 0) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "transparent" }}
      >
        <RpowerOriginalHeroBanner title="Your Order" compact />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: "#f1f5f9" }}
          >
            <ShoppingCart className="w-9 h-9" style={{ color: "#94a3b8" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f8fafc" }}>
            Your cart is empty
          </h1>
          <p className="text-sm mb-8" style={{ color: "#cbd5e1" }}>
            Add items from the menu to get started.
          </p>
          <button
            className="ro-btn-primary px-8 py-3"
            onClick={() => navigate(`/order/${slug}`)}
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Cart ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      <RpowerOriginalHeroBanner title="Your Order" compact />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Back link */}
        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="ro-btn-ghost mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Item list ── */}
          <div className="flex-1 space-y-3">
            <p className="ro-label mb-3">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>

            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="ro-panel flex gap-4 p-4"
              >
                {/* Image */}
                {item.image && !failedImages[item.id] ? (
                  <div
                    className="w-20 h-20 shrink-0 overflow-hidden rounded"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedImages((p) => ({ ...p, [item.id]: true }))
                      }
                    />
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 shrink-0 rounded flex items-center justify-center"
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <ShoppingCart
                      className="w-5 h-5"
                      style={{ color: "#cbd5e1" }}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-semibold text-sm leading-snug"
                      style={{ color: "#f8fafc" }}
                    >
                      {item.name}
                    </h3>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="shrink-0 p-1 rounded transition-colors"
                      style={{ color: "#94a3b8" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--ro-red)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#94a3b8")
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.modifiers?.length > 0 && (
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: "#cbd5e1" }}
                    >
                      {item.modifiers.map((m) => m.option_name).join(", ")}
                    </p>
                  )}
                  {item.specialInstructions && (
                    <p
                      className="text-xs italic mt-1"
                      style={{ color: "#94a3b8" }}
                    >
                      "{item.specialInstructions}"
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="ro-qty">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        aria-label="Decrease"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        aria-label="Increase"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span
                      className="font-bold text-sm"
                      style={{ color: "var(--ro-red)" }}
                    >
                      $
                      {(
                        (item.price + (item.modifierTotal || 0)) *
                        item.quantity
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Order summary ── */}
          <div className="lg:w-72 shrink-0">
            <div className="ro-panel p-5 sticky top-24">
              <p className="ro-label mb-4">Order Summary</p>

              <div className="space-y-2.5 text-sm">
                <div
                  className="flex justify-between"
                  style={{ color: "#cbd5e1" }}
                >
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div
                  className="flex justify-between"
                  style={{ color: "#cbd5e1" }}
                >
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <div className="ro-divider my-4" />

              <div
                className="flex justify-between font-bold text-base mb-5"
                style={{ color: "#f8fafc" }}
              >
                <span>Total</span>
                <span style={{ color: "var(--ro-red)" }}>
                  ${total.toFixed(2)}
                </span>
              </div>

              <button
                className="ro-btn-primary w-full h-12 text-sm"
                onClick={() => navigate(`/checkout/${slug}`)}
              >
                Proceed to Checkout
              </button>

              <button
                onClick={() => navigate(`/order/${slug}`)}
                className="ro-btn-ghost w-full justify-center mt-3 h-9 text-sm"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpowerOriginalCartPage;
