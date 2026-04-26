import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import { Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { useRpowerOriginalTheme } from "./RpowerOriginalTheme";
import rpowerLogo from "../../images/rpower-logo.png";

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
          background: "#ffffff",
          borderRadius: "8px 8px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: "3px solid #cc0000" }}
        >
          <div className="flex-1 pr-4">
            <h3
              className="text-lg font-bold leading-snug"
              style={{ color: "#1e293b" }}
            >
              {item?.name}
            </h3>
            {item?.description && (
              <p className="text-sm mt-1" style={{ color: "#475569" }}>
                {item.description}
              </p>
            )}
            <p
              className="text-base font-bold mt-2"
              style={{ color: "#cc0000" }}
            >
              ${(item?.price || 0).toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
            style={{ background: "#f1f5f9", color: "#475569" }}
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
                          attempted && !satisfied ? "#cc0000" : "#fff5f5",
                        color: attempted && !satisfied ? "#ffffff" : "#cc0000",
                        border: "1px solid #cc0000",
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
                    style={{ color: "#cc0000" }}
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
                          background: checked ? "#fff5f5" : "#f8fafc",
                          border: `1px solid ${checked ? "#cc0000" : "#e2e8f0"}`,
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
                            style={{ color: "#1e293b" }}
                          >
                            {option.name}
                          </span>
                        </div>
                        {!!option.price && (
                          <span
                            className="text-sm"
                            style={{ color: "#475569" }}
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
          style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}
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
  const { items: cartItems, getItemCount, getTotal } = useCartStore();
  const cartCount = getItemCount();
  const cartTotal = getTotal();

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

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

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#f8fafc" }}>
        {/* Header skeleton */}
        <div
          style={{
            background: "#0f172a",
            borderBottom: "3px solid #cc0000",
            height: "67px",
          }}
        />
        {/* Cat strip skeleton */}
        <div
          className="flex gap-6 px-8 py-3"
          style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}
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
    <div className="min-h-screen" style={{ background: "#f8fafc" }}>
      {/* ── Sticky Header ── */}
      <header className="ro-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + merchant name */}
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={rpowerLogo}
              alt="RPOWER"
              className="h-8 w-auto object-contain shrink-0"
            />
            {merchant?.name && (
              <>
                <div
                  className="w-px h-5 shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                />
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                >
                  {merchant.name}
                </span>
              </>
            )}
          </div>

          {/* Cart button */}
          {cartCount > 0 ? (
            <button
              onClick={() => navigate(`/order/${slug}/cart`)}
              className="ro-btn-primary shrink-0 px-4 h-9"
              style={{ fontSize: "0.8rem" }}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Order</span>
              <span
                className="font-bold px-1.5 py-0.5 rounded text-xs"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                {cartCount}
              </span>
              <span className="font-bold">${cartTotal.toFixed(2)}</span>
            </button>
          ) : (
            <div className="w-px" />
          )}
        </div>
      </header>

      {/* ── Merchant Info Bar ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <h1
            className="text-4xl font-semibold tracking-tight"
            style={{ color: "#0f172a" }}
          >
            {merchant?.name}
          </h1>
          {merchant?.license_info?.address_line1 && (
            <p className="text-sm mt-0.5" style={{ color: "#475569" }}>
              {[
                merchant.license_info.address_line1,
                merchant.license_info.city,
                merchant.license_info.state,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Category Strip ── */}
      {categories.length > 0 && (
        <div className="ro-cat-strip">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 ro-scroll-x">
            <div className="flex">
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
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "#94a3b8" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setActiveCat(null);
            }}
            placeholder="Search menu…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "#1e293b" }}
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
            <h2 className="text-lg font-bold" style={{ color: "#1e293b" }}>
              {activeCatName}
            </h2>
            <div className="flex-1 ro-divider" />
          </div>
        )}
        {search && (
          <p className="text-sm mb-5" style={{ color: "#475569" }}>
            Results for <strong style={{ color: "#1e293b" }}>"{search}"</strong>
          </p>
        )}

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-base font-semibold" style={{ color: "#475569" }}>
              No items found
            </p>
            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
              Try a different search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.2 }}
                className="ro-card flex flex-col"
                onClick={() => setSelectedItem(item)}
              >
                {/* Item image */}
                {item.image_url ? (
                  <div
                    style={{
                      height: 180,
                      overflow: "hidden",
                      background: "#f1f5f9",
                    }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.parentElement.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center"
                    style={{ height: 140, background: "#f1f5f9" }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "#e2e8f0" }}
                    >
                      <ShoppingCart
                        className="w-5 h-5"
                        style={{ color: "#94a3b8" }}
                      />
                    </div>
                  </div>
                )}

                {/* Item info */}
                <div className="flex flex-col flex-1 p-4">
                  <h3
                    className="font-semibold text-sm leading-snug"
                    style={{ color: "#1e293b" }}
                  >
                    {item.name}
                  </h3>
                  {item.description && (
                    <p
                      className="text-xs mt-1 line-clamp-2 flex-1"
                      style={{ color: "#64748b" }}
                    >
                      {item.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className="font-bold text-base"
                      style={{ color: "#cc0000" }}
                    >
                      ${(item.price || 0).toFixed(2)}
                    </span>
                    <button
                      className="ro-btn-primary px-4 py-2 text-xs"
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

      {/* ── Mobile floating cart bar ── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 lg:hidden px-4 py-3"
            style={{
              background: "#ffffff",
              borderTop: "2px solid #cc0000",
              boxShadow: "0 -4px 16px rgba(0,0,0,0.10)",
            }}
          >
            <button
              onClick={() => navigate(`/order/${slug}/cart`)}
              className="ro-btn-primary w-full h-12 flex items-center justify-between px-5"
            >
              <span
                className="font-bold text-sm px-2 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                {cartCount}
              </span>
              <span className="font-semibold text-sm">View Order</span>
              <span className="font-bold text-sm">${cartTotal.toFixed(2)}</span>
            </button>
          </motion.div>
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
