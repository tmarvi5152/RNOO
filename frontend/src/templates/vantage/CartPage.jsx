import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Minus, Plus, ShoppingBag, Trash2, ArrowLeft } from "lucide-react";
import { useVantageTheme } from "./VantageTheme";

const VantageCartPage = () => {
  useVantageTheme();
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

  if (itemCount === 0) {
    return (
      <div className="min-h-screen bg-[#f8f8f5] px-6 py-12">
        <div className="max-w-3xl mx-auto vantage-surface p-10 text-center">
          <h1 className="text-3xl font-light tracking-wide">
            Your Cart Is Empty
          </h1>
          <p className="mt-3 text-black/60">
            Add a few items to start your Vantage checkout experience.
          </p>
          <Button
            className="mt-6 rounded-full px-8"
            onClick={() => navigate(`/order/${slug}`)}
          >
            Browse Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f5]">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-black/70 hover:text-black"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-light tracking-wide">
              Your Selections
            </h1>
            <p className="text-black/60 mt-2">{itemCount} items in your cart</p>
          </div>
          <Badge variant="outline" className="vantage-pill px-4 py-1.5">
            Vantage Cart
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="vantage-surface p-4"
              >
                <div className="flex gap-4">
                  {item.image && !failedImages[item.id] ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 rounded-xl object-cover bg-black/5"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-black/5 flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-black/30" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-lg leading-tight">
                          {item.name}
                        </h3>
                        {item.modifiers?.length > 0 && (
                          <p className="text-sm text-black/60 mt-1 line-clamp-2">
                            {item.modifiers
                              .map((m) => m.option_name)
                              .join(", ")}
                          </p>
                        )}
                        {item.specialInstructions && (
                          <p className="text-xs italic text-black/55 mt-1">
                            "{item.specialInstructions}"
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-black/40 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 bg-black/5 rounded-full px-2 py-1">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="w-7 h-7 rounded-full bg-white hover:bg-black/5 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="w-7 h-7 rounded-full bg-white hover:bg-black/5 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold">
                        ${item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div>
            <div className="vantage-surface p-6 sticky top-8">
              <h2 className="text-xl font-medium">Summary</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-black/65">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-black/65">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <Button
                className="w-full mt-6 rounded-full h-11"
                onClick={() => navigate(`/checkout/${slug}`)}
              >
                Continue to Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VantageCartPage;
