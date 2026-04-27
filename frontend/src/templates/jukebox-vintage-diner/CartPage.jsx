import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Minus, Trash2, Sparkles } from "lucide-react";
import { useCartStore } from "../../stores/cartStore";
import { useJukeboxTheme } from "./JukeboxTheme";
import { apiService } from "../../context/AppContext";
import { toast } from "sonner";

const buildFallbackUpsells = (allMenuItems, cartItemIds, limit = 3) => {
  const cartIdSet = new Set((cartItemIds || []).map((id) => String(id)));
  const cartItems = (allMenuItems || []).filter((item) =>
    cartIdSet.has(String(item?.id)),
  );
  const cartCategorySet = new Set(
    cartItems.map((item) => String(item?.category_id || "")).filter(Boolean),
  );

  const candidates = (allMenuItems || []).filter(
    (item) => item?.id && !cartIdSet.has(String(item.id)),
  );

  const crossCategory = candidates.filter(
    (item) => !cartCategorySet.has(String(item?.category_id || "")),
  );

  const picked = (crossCategory.length > 0 ? crossCategory : candidates)
    .sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      reason:
        crossCategory.length > 0
          ? "Great add-on from another category"
          : "Popular add-on suggestion",
    }));

  return picked;
};

const JukeboxCartPage = () => {
  useJukeboxTheme();
  const { slug } = useParams();
  const navigate = useNavigate();

  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    addItem,
    getSubtotal,
    getTax,
    getTotal,
    getItemCount,
    merchantId,
    merchantSlug,
  } = useCartStore();

  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellItems, setUpsellItems] = useState([]);

  const cartItemIds = useMemo(
    () =>
      (items || [])
        .map((item) => item.itemId || item.menu_item_id)
        .filter(Boolean)
        .map((itemId) => String(itemId)),
    [items],
  );

  useEffect(() => {
    let canceled = false;

    const loadUpsellItems = async () => {
      if (!merchantId || cartItemIds.length === 0) {
        setUpsellItems([]);
        return;
      }

      setUpsellLoading(true);
      try {
        const menuResponse = await apiService.getMenuItems(merchantId);
        const allMenuItems = (menuResponse.data || []).filter(
          (item) => item?.id,
        );
        const nextItems = buildFallbackUpsells(allMenuItems, cartItemIds, 3);

        if (canceled) {
          return;
        }

        setUpsellItems(nextItems);
      } catch (error) {
        if (!canceled) {
          setUpsellItems([]);
        }
        console.error(
          "Failed to load local menu-export upsell suggestions:",
          error,
        );
      } finally {
        if (!canceled) {
          setUpsellLoading(false);
        }
      }
    };

    loadUpsellItems();

    return () => {
      canceled = true;
    };
  }, [merchantId, cartItemIds]);

  const handleAddUpsell = (item) => {
    addItem(item, 1, [], "", merchantId, merchantSlug || slug);
    toast.success(`Added ${item.name}`);
  };

  return (
    <div className="juke-shell min-h-screen px-3 py-4 pb-28 lg:pb-0">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(`/order/${slug}`)}
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to menu
        </button>

        <div className="juke-pad p-4 rounded-lg">
          <div className="juke-clipboard rounded" />
          <div className="flex items-end justify-between mt-2">
            <h1 className="juke-item-title text-4xl">Waitress Pad</h1>
            <p className="font-mono text-sm">{getItemCount()} items</p>
          </div>

          <div className="mt-4 space-y-2">
            {items.length === 0 && (
              <p className="text-black/60">
                No items yet. Pick your diner favorites first.
              </p>
            )}
            {items.map((item) => (
              <div key={item.id} className="juke-pad-item pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="juke-pad-item-name leading-tight">
                      {item.name}
                    </p>
                    {item.selectedModifiers?.length > 0 && (
                      <p className="text-xs text-black/60 mt-1">
                        {item.selectedModifiers
                          .map((m) => m.option_name)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="juke-pad-item-price text-sm">
                    ${Number(item.totalPrice || 0).toFixed(2)}
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 border border-black/30 bg-white grid place-items-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-7 text-center font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 border border-black/30 bg-white grid place-items-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-auto w-8 h-8 border border-red-400 bg-red-100 text-red-800 grid place-items-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="mt-4 rounded-md border border-black/20 bg-white/80 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--juke-red)]" />
                <p className="text-sm font-semibold uppercase tracking-wide">
                  AI Suggestive Selling
                </p>
              </div>

              {upsellLoading ? (
                <p className="text-xs text-black/60 mt-2">
                  Loading recommendations...
                </p>
              ) : upsellItems.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {upsellItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-black/10 bg-[var(--juke-paper)] p-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-black/60 mt-0.5">
                            {item.reason}
                          </p>
                          <p className="font-mono text-sm mt-1">
                            ${Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddUpsell(item)}
                          className="juke-ring-btn h-9 px-3 text-xs shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-black/60 mt-2">
                  No cross-category add-ons available right now.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 rounded-md border border-black/20 bg-white/70 p-3 font-mono text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${getSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${getTax().toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>${getTotal().toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={clearCart}
              className="h-11 px-4 border border-black/30 bg-white text-sm uppercase tracking-wide"
            >
              Clear Pad
            </button>
            <button
              onClick={() => navigate(`/checkout/${slug}`)}
              disabled={items.length === 0}
              className="juke-ring-btn h-11 px-5 text-sm sm:ml-auto"
            >
              Ring it up
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/15 bg-[var(--juke-paper)]/95 p-3 lg:hidden backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-black/60 uppercase tracking-wide">
              Total
            </p>
            <p className="text-lg font-bold font-mono">
              ${getTotal().toFixed(2)}
            </p>
          </div>
          <button
            onClick={() => navigate(`/checkout/${slug}`)}
            disabled={items.length === 0}
            className="juke-ring-btn h-12 px-5 text-sm"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

export default JukeboxCartPage;
