import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import { Textarea } from "../../components/ui/textarea";
import { Skeleton } from "../../components/ui/skeleton";
import { Minus, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useCraveTheme } from "./CraveTheme";

const CraveModifierModal = ({
  item,
  merchantId,
  merchantSlug,
  onClose,
  onAdded,
}) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedCounts, setSelectedCounts] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!item) return;
    const defaults = {};
    item.modifier_groups?.forEach((group) => {
      const next = {};
      group.options?.forEach((opt) => {
        next[opt.id] = opt.is_default ? 1 : 0;
      });
      defaults[group.id] = next;
    });
    setSelectedCounts(defaults);
    setQuantity(1);
    setSpecialInstructions("");
    setAttempted(false);
  }, [item]);

  const groupCount = useCallback(
    (groupId) => {
      const map = selectedCounts[groupId] || {};
      return Object.values(map).reduce((sum, n) => sum + Number(n || 0), 0);
    },
    [selectedCounts],
  );

  const setOptionCount = useCallback((group, optionId, nextCount) => {
    setSelectedCounts((prev) => {
      const currGroup = { ...(prev[group.id] || {}) };
      const min = 0;
      const max = group.max_selections || 99;
      const currentTotal = Object.values(currGroup).reduce(
        (sum, n) => sum + Number(n || 0),
        0,
      );
      const existing = Number(currGroup[optionId] || 0);
      let safeCount = Math.max(min, nextCount);

      if (group.max_selections === 1 && safeCount > 0) {
        Object.keys(currGroup).forEach((k) => {
          currGroup[k] = 0;
        });
        safeCount = 1;
      }

      const projectedTotal = currentTotal - existing + safeCount;
      if (projectedTotal > max) {
        return prev;
      }

      currGroup[optionId] = safeCount;
      return { ...prev, [group.id]: currGroup };
    });
  }, []);

  const isGroupSatisfied = useCallback(
    (group) => {
      if (!group.is_required) return true;
      const count = groupCount(group.id);
      return count >= (group.min_selections || 1);
    },
    [groupCount],
  );

  const selectedModifierTotal = useMemo(() => {
    if (!item) return 0;
    let total = 0;
    item.modifier_groups?.forEach((group) => {
      const map = selectedCounts[group.id] || {};
      group.options?.forEach((opt) => {
        const c = Number(map[opt.id] || 0);
        if (c > 0) total += (opt.price || 0) * c;
      });
    });
    return total;
  }, [item, selectedCounts]);

  const handleAdd = () => {
    setAttempted(true);
    for (const group of item.modifier_groups || []) {
      if (!isGroupSatisfied(group)) {
        toast.error(`Please select: ${group.name}`);
        return;
      }
    }

    const modifiers = [];
    item.modifier_groups?.forEach((group) => {
      const map = selectedCounts[group.id] || {};
      group.options?.forEach((opt) => {
        const count = Number(map[opt.id] || 0);
        if (!count) return;
        for (let i = 0; i < count; i++) {
          modifiers.push({
            group_id: group.id,
            group_name: group.name,
            option_id: opt.id,
            option_name: opt.name,
            price: opt.price || 0,
            plu: opt.plu || "",
            shepherd_pos_id: opt.shepherd_pos_id || "",
          });
        }
      });
    });

    addItem(
      item,
      quantity,
      modifiers,
      specialInstructions,
      merchantId,
      merchantSlug,
    );
    onAdded?.();
    toast.success(`${item.name} added`);
    onClose();
  };

  const lineTotal = ((item?.price || 0) + selectedModifierTotal) * quantity;

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 md:bg-black/50 md:p-4 md:backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="h-full w-full bg-white flex flex-col md:max-w-3xl md:mx-auto md:rounded-3xl md:overflow-hidden md:border md:border-slate-200 md:shadow-2xl"
      >
        <div className="h-14 md:h-16 border-b border-[var(--crv-border)] px-4 md:px-6 flex items-center justify-between bg-white">
          <h2 className="font-bold text-base md:text-lg">Customize Item</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-32 md:pb-28">
          <div className="py-4 border-b border-[var(--crv-border)]">
            <h3 className="text-xl md:text-2xl font-bold text-slate-900">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-sm md:text-base text-slate-500 mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
            <p className="text-base md:text-lg font-bold mt-1 text-[var(--crv-accent)]">
              ${(item.price || 0).toFixed(2)}
            </p>
          </div>

          {(item.modifier_groups || []).map((group) => {
            const satisfied = isGroupSatisfied(group);
            const gCount = groupCount(group.id);
            return (
              <div
                key={group.id}
                className="py-4 md:py-5 border-b border-slate-200 last:border-b-0"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <p className="font-semibold text-sm md:text-base text-slate-800">
                    {group.name}
                  </p>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      attempted && !satisfied
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {group.is_required
                      ? `Required (${gCount}/${group.min_selections || 1})`
                      : "Optional"}
                  </span>
                </div>

                <div className="space-y-2">
                  {(group.options || []).map((opt) => {
                    const count = Number(
                      selectedCounts[group.id]?.[opt.id] || 0,
                    );
                    return (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0"
                      >
                        <div>
                          <p className="text-sm md:text-base font-medium text-slate-800">
                            {opt.name}
                          </p>
                          {opt.price > 0 && (
                            <p className="text-xs text-slate-500">
                              +${opt.price.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-1 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              setOptionCount(group, opt.id, count - 1)
                            }
                            className="w-9 h-9 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center"
                            aria-label={`Decrease ${opt.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setOptionCount(group, opt.id, count + 1)
                            }
                            className="w-9 h-9 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center"
                            aria-label={`Increase ${opt.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="py-4">
            <label className="text-sm font-semibold text-slate-700 block mb-2">
              Special Instructions
            </label>
            <Textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="No onions, sauce on side..."
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[71] bg-white border-t border-[var(--crv-border)] p-4 md:px-6 md:rounded-b-3xl md:max-w-3xl md:mx-auto md:left-4 md:right-4 flex items-center gap-3">
          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-1 py-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 transition-colors flex items-center justify-center"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center text-sm font-bold">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 transition-colors flex items-center justify-center"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 h-12 rounded-full crv-accent-bg hover:brightness-95 transition-[filter] font-bold text-sm"
          >
            Add to Order - ${lineTotal.toFixed(2)}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const CraveMenuPage = () => {
  useCraveTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const heroImageY = useTransform(scrollY, [0, 280], [0, -18]);
  const heroImageScale = useTransform(scrollY, [0, 280], [1, 1.05]);
  const heroContentOpacity = useTransform(scrollY, [0, 260], [1, 0.86]);
  const heroContentY = useTransform(scrollY, [0, 260], [0, -6]);
  const {
    items,
    getItemCount,
    getSubtotal,
    getTax,
    getTotal,
    updateQuantity,
    removeItem,
  } = useCartStore();

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [fabPulse, setFabPulse] = useState(false);

  const cartCount = getItemCount();
  const cartSubtotal = getSubtotal();
  const cartTax = getTax();
  const cartTotal = getTotal();
  const heroImage =
    merchant?.branding?.banner_url ||
    menuItems.find((item) => item.image_url)?.image_url ||
    "";

  const loadMenuData = useCallback(async () => {
    try {
      setLoading(true);
      const merchantRes = await apiService.getMerchantBySlug(slug);
      const merchantData = merchantRes.data;
      setMerchant(merchantData);

      const [categoriesRes, itemsRes] = await Promise.all([
        apiService.getCategories(merchantData.id),
        apiService.getMenuItems(merchantData.id),
      ]);

      setCategories(categoriesRes.data || []);
      setMenuItems(itemsRes.data || []);
      if (categoriesRes.data?.length) {
        setSelectedCategory(categoriesRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load menu:", err);
      toast.error("Failed to load menu");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const inCategory =
        !selectedCategory || item.category_id === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const inSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  const handleAddedPulse = () => {
    setFabPulse(true);
    setTimeout(() => setFabPulse(false), 360);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--crv-bg)] px-4 py-5 lg:px-6">
        <div className="max-w-6xl mx-auto space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-10 w-full rounded-2xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#ffe4e6_0%,#f8fafc_36%)] text-[var(--crv-text)]">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[var(--crv-border)] px-4 py-3 lg:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl lg:text-2xl font-black truncate">
                {merchant?.name || "Crave"}
              </h1>
              {merchant?.description && (
                <p className="text-xs lg:text-sm text-slate-500 truncate mt-0.5">
                  {merchant.description}
                </p>
              )}
            </div>
            {cartCount > 0 && (
              <p className="hidden lg:inline-flex px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                {cartCount} item{cartCount > 1 ? "s" : ""} in cart
              </p>
            )}
          </div>
          <div className="mt-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu"
              className="w-full h-10 lg:h-11 rounded-full bg-slate-100/90 pl-9 pr-3 text-sm outline-none border border-transparent focus:border-slate-300"
            />
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 lg:px-6 pt-3">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900 h-36 lg:h-44 shadow-[0_14px_38px_rgba(15,23,42,0.14)]">
          {heroImage ? (
            <motion.img
              src={heroImage}
              alt={merchant?.name || "Store banner"}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ y: heroImageY, scale: heroImageScale }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />

          <motion.div
            style={{ opacity: heroContentOpacity, y: heroContentY }}
            className="relative h-full px-4 lg:px-6 py-4 lg:py-5 flex flex-col justify-end"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-6 items-center rounded-full bg-white/15 border border-white/30 px-2.5 text-[11px] font-semibold text-white backdrop-blur">
                Crave Mode
              </span>
              <span className="inline-flex h-6 items-center rounded-full bg-[var(--crv-accent)] px-2.5 text-[11px] font-semibold text-white">
                Fast Pickup
              </span>
            </div>

            <h2 className="text-white text-xl lg:text-3xl font-black leading-tight max-w-2xl">
              {merchant?.name || "Fresh, fast, and made for cravings"}
            </h2>

            <p className="text-white/80 text-xs lg:text-sm mt-1 line-clamp-1 max-w-xl">
              {merchant?.description ||
                "Build your order fast with one-hand friendly browsing and quick modifiers."}
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 overflow-x-auto lg:px-6">
        <div className="flex gap-2 min-w-max pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 lg:px-5 h-9 lg:h-10 rounded-full text-sm font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? "crv-accent-bg"
                  : "bg-white border border-[var(--crv-border)] text-slate-600"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 pb-28 lg:px-6 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0 space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl lg:rounded-3xl shadow-sm border border-slate-100 p-2.5 lg:p-3.5 flex items-center gap-3"
          >
            {item.image_url && !failedImages[item.id] ? (
              <img
                src={item.image_url}
                alt={item.name}
                onError={() =>
                  setFailedImages((prev) => ({
                    ...prev,
                    [item.id]: true,
                  }))
                }
                className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl object-cover bg-slate-100 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-slate-100 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm lg:text-base text-slate-900 truncate">
                {item.name}
              </p>
              {item.description && (
                <p className="text-xs lg:text-sm text-slate-500 line-clamp-1 mt-0.5">
                  {item.description}
                </p>
              )}
              <p className="mt-1 text-sm lg:text-base font-bold text-[var(--crv-accent)]">
                ${(item.price || 0).toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedItem(item)}
              className="h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-slate-900 text-white text-sm font-semibold shrink-0 hover:bg-slate-800 transition-colors"
            >
              Add
            </button>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            No items found.
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedItem && (
          <CraveModifierModal
            item={selectedItem}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
            onClose={() => setSelectedItem(null)}
            onAdded={handleAddedPulse}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: fabPulse ? [1, 1.16, 1] : 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.3 }}
            type="button"
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 right-5 lg:bottom-8 lg:right-8 z-40 w-16 h-16 rounded-full bg-[var(--crv-accent)] text-white shadow-[0_14px_24px_rgba(239,68,68,0.35)] flex items-center justify-center"
          >
            <ShoppingBag className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-700 text-white text-xs font-bold flex items-center justify-center border-2 border-white">
              {cartCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setCartOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="fixed z-[60] bg-white inset-0 md:inset-y-4 md:right-4 md:left-auto md:w-[440px] md:rounded-3xl md:border md:border-slate-200 md:shadow-2xl flex flex-col"
            >
              <div className="h-14 border-b border-[var(--crv-border)] px-4 flex items-center justify-between">
                <h2 className="font-bold text-base">Your Cart</h2>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        {item.modifiers?.length > 0 && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {item.modifiers
                              .map((m) => m.option_name)
                              .join(", ")}
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
                ))}
              </div>

              <div className="border-t border-[var(--crv-border)] p-4">
                <div className="text-sm space-y-1 mb-3">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax</span>
                    <span>${cartTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/checkout/${slug}`)}
                  className="w-full h-12 rounded-full crv-accent-bg font-bold"
                >
                  Proceed to Checkout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CraveMenuPage;
