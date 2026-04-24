import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useCartStore } from "../../stores/cartStore";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  ArrowLeft,
  ClipboardList,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  CreditCard,
} from "lucide-react";
import { useRpowerJimBaldridgeTheme } from "./Theme";
import LegacyLockup from "./LegacyLockup";

const RpowerJimBaldridgeCartPage = () => {
  useRpowerJimBaldridgeTheme();
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
      <div className="min-h-screen bg-[#0f1115] px-6 py-12 text-white">
        <div className="max-w-3xl mx-auto rjb-surface p-10 text-center">
          <h1 className="text-3xl font-light tracking-wide">Cart is Empty</h1>
          <p className="mt-3 text-white/65">
            Add items from the menu to begin your order.
          </p>
          <Button
            className="mt-6 rounded-full"
            onClick={() => navigate(`/order/${slug}`)}
          >
            Browse Menu
          </Button>
          <LegacyLockup className="mt-5" compact />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <Badge className="rjb-pill text-[#f6c453] border-[#f6c45366] bg-[#f6c45314] mb-3 uppercase tracking-[0.14em]">
              Legacy Ticket Cart
            </Badge>
            <h1 className="text-4xl font-light tracking-wide">
              Ticket Builder
            </h1>
            <p className="text-white/65 mt-2">
              {itemCount} line item{itemCount === 1 ? "" : "s"} in service
              ticket
            </p>
          </div>
          <LegacyLockup compact />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <div className="xl:col-span-2 space-y-4">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="rjb-surface p-4 md:p-5 border-l-4 border-l-[#e8ba53]"
              >
                <div className="flex gap-4">
                  {item.image && !failedImages[item.id] ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 rounded-xl object-cover bg-black/30"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-black/35 flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-white/35" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-[#e8ba53]/85 mb-1">
                          Ticket Line
                        </p>
                        <h3 className="font-medium text-lg">{item.name}</h3>
                        {item.modifiers?.length > 0 && (
                          <p className="text-sm text-white/65 mt-1 line-clamp-2">
                            {item.modifiers
                              .map((m) => m.option_name)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-white/45 hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 bg-black/35 rounded-md px-2 py-1 border border-[#e8ba5333]">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="w-7 h-7 rounded-sm bg-[#1f242e] hover:bg-[#2a303c] flex items-center justify-center"
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
                          className="w-7 h-7 rounded-sm bg-[#1f242e] hover:bg-[#2a303c] flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-semibold text-[#f6c453]">
                        ${item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div>
            <div className="rjb-surface p-6 sticky top-8 border-t-4 border-t-[#cf2030]">
              <h2 className="text-xl font-medium inline-flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#e8ba53]" />
                Settlement Panel
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-white/70">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <Separator className="my-4 bg-white/15" />

              <div className="flex justify-between text-lg font-semibold">
                <span>Total Due</span>
                <span className="text-[#f6c453]">${total.toFixed(2)}</span>
              </div>

              <p className="mt-3 text-[11px] text-white/55 leading-relaxed">
                Ticket totals include configured tax. Final confirmation happens
                on the checkout ledger page.
              </p>

              <Button
                className="w-full mt-6 rounded-md h-11 bg-[#cf2030] hover:bg-[#b11928] uppercase tracking-wide text-[13px]"
                onClick={() => navigate(`/checkout/${slug}`)}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Continue to Ticket Checkout
              </Button>
              <LegacyLockup className="mt-4" compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpowerJimBaldridgeCartPage;
