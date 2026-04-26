import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import {
  ChevronRight,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import RpowerOriginalHeroBanner from "./HeroBanner";

// ─── Modifier Modal ───────────────────────────────────────────────────────────

const OriginalModal = ({ item, merchantId, merchantSlug, onClose }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!item) return;
    const defaults = {};
    item.modifier_groups?.forEach((group) => {
      const def = group.options?.find((o) => o.is_default);
      if (group.max_selections === 1) {
        defaults[group.id] = def?.id || null;
      } else {
        defaults[group.id] = def?.id ? [def.id] : [];
      }
    });
    setSelectedModifiers(defaults);
    setAttempted(false);
    setQuantity(1);
    setSpecialInstructions("");
  }, [item]);

  const modifierTotal = useMemo(() => {
    if (!item) return 0;
    let t = 0;
    item.modifier_groups?.forEach((group) => {
      const sel = selectedModifiers[group.id];
      if (Array.isArray(sel)) {
        sel.forEach((id) => {
          const opt = group.options?.find((o) => o.id === id);
          if (opt) t += opt.price || 0;
        });
      } else if (sel) {
        const opt = group.options?.find((o) => o.id === sel);
        if (opt) t += opt.price || 0;
      }
    });
    return t;
  }, [item, selectedModifiers]);

  const isGroupSatisfied = (group) => {
    if (!group?.is_required) return true;
    const sel = selectedModifiers[group.id];
    const min = group.min_selections || 1;
    if (group.max_selections === 1) return Boolean(sel);
    return Array.isArray(sel) && sel.length >= min;
  };

  const handleModChange = (groupId, optionId, isMultiple, maxSelections) => {
    setSelectedModifiers((prev) => {
      if (!isMultiple) return { ...prev, [groupId]: optionId };
      const cur = prev[groupId] || [];
      if (cur.includes(optionId))
        return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
      if (cur.length >= maxSelections) return prev;
      return { ...prev, [groupId]: [...cur, optionId] };
    });
  };

  const handleAdd = () => {
    setAttempted(true);
    for (const group of item.modifier_groups || []) {
      if (!group.is_required) continue;
      if (!isGroupSatisfied(group)) {
        toast.error(`Please select ${group.name}`);
        return;
      }
    }
    const modifiers = [];
    item.modifier_groups?.forEach((group) => {
      const sel = selectedModifiers[group.id];
      const push = (id) => {
        const opt = group.options?.find((o) => o.id === id);
        if (!opt) return;
        modifiers.push({
          group_id: group.id,
          group_name: group.name,
          option_id: opt.id,
          option_name: opt.name,
          price: opt.price || 0,
          plu: opt.plu || "",
          shepherd_pos_id: opt.shepherd_pos_id || "",
        });
      };
      if (Array.isArray(sel)) sel.forEach(push);
      else if (sel) push(sel);
    });
    addItem(
      item,
      quantity,
      modifiers,
      specialInstructions,
      merchantId,
      merchantSlug,
    );
    toast.success(`Added ${item.name}`);
    onClose();
  };

  const lineTotal = ((item?.price || 0) + modifierTotal) * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.84) 0%, rgba(17, 24, 39, 0.9) 100%), var(--ro-btn-bg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: "3px solid var(--ro-red)" }}
        >
          <div className="flex-1 pr-4">
            <h3
              className="text-lg font-bold leading-snug"
              style={{ color: "#f8fafc" }}
            >
              {item?.name}
            </h3>
            {item?.description && (
              <p className="text-sm mt-1" style={{ color: "#cbd5e1" }}>
                {item.description}
              </p>
            )}
            <p
              className="text-base font-bold mt-2"
              style={{ color: "var(--ro-red)" }}
            >
              ${(item?.price || 0).toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
            style={{ background: "rgba(255,255,255,0.12)", color: "#e2e8f0" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {item?.modifier_groups?.map((group) => {
            const isSingle = group.max_selections === 1;
            const satisfied = isGroupSatisfied(group);
            return (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="ro-label">{group.name}</p>
                  {group.is_required && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        background:
                          attempted && !satisfied
                            ? "var(--ro-red)"
                            : "rgba(211, 173, 103, 0.16)",
                        color:
                          attempted && !satisfied ? "#ffffff" : "var(--ro-red)",
                        border: "1px solid var(--ro-red)",
                      }}
                    >
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
                  {isSingle
                    ? "Choose one"
                    : `Choose up to ${group.max_selections}`}
                </p>
                {attempted && !satisfied && (
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{ color: "var(--ro-red)" }}
                  >
                    Please make a selection.
                  </p>
                )}
                <div className="space-y-1">
                  {group.options?.map((option) => {
                    const selVal = selectedModifiers[group.id];
                    const checked = isSingle
                      ? selVal === option.id
                      : (selVal || []).includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex items-center justify-between px-4 py-3 cursor-pointer rounded"
                        style={{
                          background: checked
                            ? "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%), var(--ro-btn-bg)"
                            : "linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(17, 24, 39, 0.82) 100%), var(--ro-btn-bg)",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: checked
                            ? "1px solid var(--ro-red)"
                            : "1px solid rgba(255,255,255,0.16)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type={isSingle ? "radio" : "checkbox"}
                            name={group.id}
                            checked={checked}
                            onChange={() =>
                              handleModChange(
                                group.id,
                                option.id,
                                !isSingle,
                                group.max_selections,
                              )
                            }
                            className="ro-radio"
                          />
                          <span
                            className="text-sm font-medium"
                            style={{ color: "#f1f5f9" }}
                          >
                            {option.name}
                          </span>
                        </div>
                        {!!option.price && (
                          <span
                            className="text-sm"
                            style={{ color: "#cbd5e1" }}
                          >
                            +${option.price.toFixed(2)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special instructions */}
          <div>
            <p className="ro-label mb-2">Special Instructions</p>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
              placeholder="Allergies, substitutions, notes…"
              className="ro-textarea text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center gap-4"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.16)",
            background:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.84) 0%, rgba(17, 24, 39, 0.88) 100%), var(--ro-btn-bg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="ro-qty">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span>{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={handleAdd} className="ro-btn-primary flex-1 h-11">
            Add to Order — ${lineTotal.toFixed(2)}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Menu Page ────────────────────────────────────────────────────────────────

const RpowerOriginalMenuPage = () => {
  useRpowerOriginalTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    items: cartItems,
    getItemCount,
    getTotal,
    getSubtotal,
    getTax,
    updateQuantity,
    removeItem,
  } = useCartStore();
  const cartCount = getItemCount();
  const cartTotal = getTotal();
  const cartSubtotal = getSubtotal();
  const cartTax = getTax();

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Load merchant + menu
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const merchantRes = await apiService.getMerchantBySlug(slug);
        const m = merchantRes.data;
        setMerchant(m);

        const [catsRes, itemsRes] = await Promise.all([
          apiService.getCategories(m.id),
          apiService.getMenuItems(m.id),
        ]);
        const cats = Array.isArray(catsRes.data) ? catsRes.data : [];
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        setCategories(cats);
        setMenuItems(items);
        if (cats.length) setActiveCat(cats[0].id);
      } catch {
        toast.error("Unable to load menu");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, navigate]);

  const filtered = useMemo(() => {
    return menuItems.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
        );
      }
      return !activeCat || item.category_id === activeCat;
    });
  }, [menuItems, activeCat, search]);

  const activeCatName = categories.find((c) => c.id === activeCat)?.name;

  const heroAddress = useMemo(() => {
    if (!merchant) return "";
    const lic = merchant.license_info || {};
    const line1 = lic.address_line1 || merchant.address_line1;
    const city = lic.city || merchant.city;
    const state = lic.state || merchant.state;
    const zip = lic.zip_code || merchant.zip_code;
    const composed = [line1, city, state, zip].filter(Boolean).join(", ");
    return composed || merchant.full_address || merchant.address || "";
  }, [merchant]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "transparent" }}>
        <div className="px-4 sm:px-6 pt-4">
          <div
            className="max-w-6xl mx-auto rounded-2xl ro-skeleton"
            style={{ height: 200 }}
          />
        </div>
        {/* Cat strip skeleton */}
        <div
          className="flex gap-6 px-8 py-3"
          style={{
            background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.16)",
          }}
        >
          {[80, 100, 70, 90].map((w, i) => (
            <div
              key={i}
              className="ro-skeleton"
              style={{ width: w, height: 16 }}
            />
          ))}
        </div>
        {/* Grid skeleton */}
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ro-panel overflow-hidden">
              <div className="ro-skeleton" style={{ height: 180 }} />
              <div className="p-4 space-y-2">
                <div
                  className="ro-skeleton"
                  style={{ height: 16, width: "70%" }}
                />
                <div
                  className="ro-skeleton"
                  style={{ height: 12, width: "90%" }}
                />
                <div
                  className="ro-skeleton"
                  style={{ height: 12, width: "60%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      <RpowerOriginalHeroBanner
        title={merchant?.name || "RPOWER Online Ordering"}
        subtitle={heroAddress}
      />

      {/* ── Category Strip ── */}
      {categories.length > 0 && (
        <div className="ro-cat-strip">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 ro-scroll-x">
            <div className="flex gap-2 py-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCat(cat.id);
                    setSearch("");
                  }}
                  className={`ro-cat-btn${activeCat === cat.id && !search ? " ro-cat-active" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-10">
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 mb-6"
          style={{
            background:
              "linear-gradient(180deg, rgba(15, 23, 42, 0.56) 0%, rgba(17, 24, 39, 0.66) 100%), var(--ro-btn-bg)",
            backgroundSize: "100% 100%, cover",
            backgroundPosition: "center",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: "18px",
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "#cbd5e1" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setActiveCat(null);
            }}
            placeholder="Search menu…"
            className="flex-1 bg-transparent outline-none text-base font-medium"
            style={{ color: "#f8fafc" }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setActiveCat(categories[0]?.id);
              }}
            >
              <X className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </button>
          )}
        </div>

        {/* Section heading */}
        {!search && activeCatName && (
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold" style={{ color: "#f8fafc" }}>
              {activeCatName}
            </h2>
            <div className="flex-1 ro-divider" />
          </div>
        )}
        {search && (
          <p className="text-sm mb-5" style={{ color: "#cbd5e1" }}>
            Results for <strong style={{ color: "#f8fafc" }}>"{search}"</strong>
          </p>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-base font-semibold" style={{ color: "#cbd5e1" }}>
              No items found
            </p>
            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
              Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className="ro-card flex flex-row items-start gap-3 sm:gap-4 p-3 sm:p-4 min-h-[146px] sm:min-h-[172px]"
                onClick={() => setSelectedItem(item)}
              >
                {/* Item image */}
                {item.image_url ? (
                  <div className="w-[88px] sm:w-[104px] shrink-0 self-stretch flex items-center justify-start">
                    <div
                      className="w-full aspect-square overflow-hidden rounded-2xl"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                        backdropFilter: "blur(3px)",
                      }}
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.parentElement.parentElement.style.display =
                            "none";
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-[88px] sm:w-[104px] shrink-0 self-stretch flex items-center justify-start">
                    <div
                      className="w-full aspect-square rounded-2xl flex items-center justify-center"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                        backdropFilter: "blur(3px)",
                      }}
                    >
                      <ShoppingCart
                        className="w-5 h-5"
                        style={{ color: "#cbd5e1" }}
                      />
                    </div>
                  </div>
                )}

                {/* Item info */}
                <div className="flex flex-col flex-1 self-stretch min-w-0">
                  <div className="flex-1 min-h-0">
                    <h3
                      className="ro-card-title font-semibold text-[0.95rem] sm:text-base leading-snug"
                      style={{ color: "#f8fafc" }}
                    >
                      {item.name}
                    </h3>
                    {item.description && (
                      <p
                        className="ro-card-copy ro-emphasis-copy mt-1.5 line-clamp-2 sm:line-clamp-3"
                        style={{ color: "#cbd5e1" }}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto pt-3 sm:pt-4 flex items-center justify-between gap-2 sm:gap-3">
                    <span
                      className="ro-price text-[1.125rem] shrink-0"
                      style={{ color: "var(--ro-red)" }}
                    >
                      ${(item.price || 0).toFixed(2)}
                    </span>
                    <button
                      className="ro-btn-primary ro-cta-text w-[92px] sm:w-[108px] h-10 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* ── Floating cart drawer ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <>
            {cartOpen && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/35"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart drawer"
              />
            )}
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="ro-floating-cart fixed right-4 bottom-4 z-50 w-[calc(100vw-2rem)] max-w-sm"
            >
              <AnimatePresence mode="wait">
                {cartOpen ? (
                  <motion.div
                    key="cart-open"
                    initial={{ opacity: 0, y: 32, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.98 }}
                    className="ro-panel overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.16)",
                      }}
                    >
                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: "#f8fafc" }}
                        >
                          Your Order
                        </p>
                        <p className="text-xs" style={{ color: "#94a3b8" }}>
                          {cartCount} item{cartCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        onClick={() => setCartOpen(false)}
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          color: "#f8fafc",
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto px-3 py-3 space-y-2">
                      {cartItems.map((cartItem) => (
                        <div
                          key={cartItem.id}
                          className="rounded-2xl px-3 py-3"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(15, 23, 42, 0.84) 0%, rgba(17, 24, 39, 0.88) 100%), var(--ro-btn-bg)",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{ color: "#f8fafc" }}
                              >
                                {cartItem.name}
                              </p>
                              {cartItem.modifiers?.length > 0 && (
                                <p
                                  className="text-xs mt-1 line-clamp-2"
                                  style={{ color: "#cbd5e1" }}
                                >
                                  {cartItem.modifiers
                                    .map((m) => m.option_name)
                                    .join(", ")}
                                </p>
                              )}
                              <p
                                className="text-sm font-bold mt-2"
                                style={{ color: "var(--ro-red)" }}
                              >
                                ${cartItem.totalPrice.toFixed(2)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeItem(cartItem.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "#cbd5e1",
                              }}
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <div className="ro-qty">
                              <button
                                onClick={() =>
                                  updateQuantity(
                                    cartItem.id,
                                    cartItem.quantity - 1,
                                  )
                                }
                                aria-label="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span>{cartItem.quantity}</span>
                              <button
                                onClick={() =>
                                  updateQuantity(
                                    cartItem.id,
                                    cartItem.quantity + 1,
                                  )
                                }
                                aria-label="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="px-4 py-4"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.16)" }}
                    >
                      <div
                        className="space-y-1.5 text-sm mb-4"
                        style={{ color: "#cbd5e1" }}
                      >
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>${cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span>${cartTax.toFixed(2)}</span>
                        </div>
                        <div
                          className="flex justify-between font-bold pt-2"
                          style={{ color: "#f8fafc" }}
                        >
                          <span>Total</span>
                          <span style={{ color: "var(--ro-red)" }}>
                            ${cartTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/checkout/${slug}`)}
                        className="ro-btn-primary w-full h-11 justify-between px-4"
                      >
                        <span>Checkout</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cart-closed"
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    onClick={() => setCartOpen(true)}
                    className="ro-btn-primary h-12 w-full justify-between px-4 shadow-[0_18px_38px_rgba(0,0,0,0.32)]"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      <span>View Order</span>
                    </span>
                    <span
                      className="font-bold px-2 py-0.5 rounded text-xs"
                      style={{ background: "rgba(255,255,255,0.24)" }}
                    >
                      {cartCount}
                    </span>
                    <span className="font-bold">${cartTotal.toFixed(2)}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modifier Modal ── */}
      <AnimatePresence>
        {selectedItem && (
          <OriginalModal
            item={selectedItem}
            merchantId={merchant?.id}
            merchantSlug={slug}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RpowerOriginalMenuPage;
