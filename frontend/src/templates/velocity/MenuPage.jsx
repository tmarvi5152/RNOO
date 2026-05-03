import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import { Skeleton } from "../../components/ui/skeleton";
import { Minus, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import FloatingCart from "../../components/consumer/FloatingCart";
import RpowerBannerBadge from "../../components/consumer/RpowerBannerBadge";
import { useVelocityTheme } from "./VelocityTheme";

/* ─── Bottom-sheet modifier modal ─────────────────────────── */
const VelocityModifierModal = ({ item, merchantId, merchantSlug, onClose }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!item) return;
    setImageFailed(false);
    setAttempted(false);
    const defaults = {};
    item.modifier_groups?.forEach((group) => {
      const defaultOption = group.options?.find((o) => o.is_default);
      if (group.max_selections === 1) {
        defaults[group.id] = defaultOption?.id || null;
      } else {
        defaults[group.id] = defaultOption?.id ? [defaultOption.id] : [];
      }
    });
    setSelectedModifiers(defaults);
  }, [item]);

  const isGroupSatisfied = useCallback(
    (group) => {
      if (!group.is_required) return true;
      const selected = selectedModifiers[group.id];
      const min = group.min_selections || 1;
      if (group.max_selections === 1) return !!selected;
      return Array.isArray(selected) && selected.length >= min;
    },
    [selectedModifiers],
  );

  const handleModifierChange = (
    groupId,
    optionId,
    isMultiple,
    maxSelections,
  ) => {
    setSelectedModifiers((prev) => {
      if (!isMultiple) return { ...prev, [groupId]: optionId };
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxSelections) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const selectedModifierTotal = useMemo(() => {
    if (!item) return 0;
    let total = 0;
    item.modifier_groups?.forEach((group) => {
      const selected = selectedModifiers[group.id];
      if (Array.isArray(selected)) {
        selected.forEach((id) => {
          const opt = group.options?.find((o) => o.id === id);
          if (opt) total += opt.price || 0;
        });
      } else if (selected) {
        const opt = group.options?.find((o) => o.id === selected);
        if (opt) total += opt.price || 0;
      }
    });
    return total;
  }, [item, selectedModifiers]);

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
      const selected = selectedModifiers[group.id];
      if (Array.isArray(selected)) {
        selected.forEach((id) => {
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
        });
      } else if (selected) {
        const opt = group.options?.find((o) => o.id === selected);
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
      }
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

  const lineTotal = ((item?.price || 0) + selectedModifierTotal) * quantity;

  return (
    /* overlay */
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        className="relative w-full max-w-2xl rounded-t-3xl bg-white overflow-hidden flex flex-col"
        style={{ height: "85dvh" }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-black/20" />
        </div>

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 z-10 w-8 h-8 rounded-full bg-[#f4f4f4] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* item image */}
        {!imageFailed && item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-44 object-cover shrink-0"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-16 bg-[#f4f4f4] shrink-0" />
        )}

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          <div>
            <h2 className="text-xl font-bold leading-tight">{item.name}</h2>
            {item.description && (
              <p className="text-sm text-black/55 mt-1">{item.description}</p>
            )}
            <p className="mt-1 text-base font-semibold text-[var(--vel-accent)]">
              ${(item.price || 0).toFixed(2)}
            </p>
          </div>

          {item.modifier_groups?.map((group) => {
            const isSingle = group.max_selections === 1;
            const satisfied = isGroupSatisfied(group);
            const showHighlight = attempted && !satisfied;
            return (
              <div
                key={group.id}
                className={`rounded-2xl p-4 transition-colors ${
                  showHighlight
                    ? "vel-required-bg"
                    : group.is_required
                      ? "bg-[#fafafa] border border-[#eee]"
                      : "bg-[#f7f7f7]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm">{group.name}</span>
                  {group.is_required && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        satisfied
                          ? "bg-green-100 text-green-700"
                          : "bg-[#ff4405] text-white"
                      }`}
                    >
                      {satisfied ? "✓" : "Required"}
                    </span>
                  )}
                </div>

                {isSingle ? (
                  /* chunky pill buttons */
                  <div className="flex flex-wrap gap-2">
                    {group.options?.map((opt) => {
                      const active = selectedModifiers[group.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            handleModifierChange(
                              group.id,
                              opt.id,
                              false,
                              group.max_selections,
                            )
                          }
                          className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                            active
                              ? "border-[var(--vel-accent)] bg-[var(--vel-accent)] text-white"
                              : "border-[#ddd] bg-white text-black hover:border-[var(--vel-accent)]"
                          }`}
                        >
                          {opt.name}
                          {opt.price > 0 && (
                            <span className="ml-1 opacity-75 font-normal">
                              +${opt.price.toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* compact checkbox rows */
                  <div className="space-y-2.5">
                    {group.options?.map((opt) => {
                      const checked = (
                        selectedModifiers[group.id] || []
                      ).includes(opt.id);
                      return (
                        <label
                          key={opt.id}
                          className="flex items-center justify-between cursor-pointer py-1"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`vel-opt-${opt.id}`}
                              checked={checked}
                              onCheckedChange={() =>
                                handleModifierChange(
                                  group.id,
                                  opt.id,
                                  true,
                                  group.max_selections,
                                )
                              }
                            />
                            <span className="text-sm">{opt.name}</span>
                          </div>
                          {opt.price > 0 && (
                            <span className="text-sm text-black/55">
                              +${opt.price.toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div>
            <label className="text-sm font-semibold block mb-1">
              Special Instructions
            </label>
            <Textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={2}
              placeholder="Any customizations or allergies?"
              className="text-sm rounded-xl"
            />
          </div>

          {/* bottom spacer so content isn't hidden under footer */}
          <div className="h-4" />
        </div>

        {/* sticky footer */}
        <div className="shrink-0 border-t border-[#eee] px-5 py-4 flex items-center gap-3 bg-white">
          {/* quantity */}
          <div className="inline-flex items-center gap-1 bg-[#f4f4f4] rounded-full px-1 py-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center font-bold text-sm">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 h-12 rounded-2xl vel-accent-bg font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            Add to Cart — ${lineTotal.toFixed(2)}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── Main Menu Page ──────────────────────────────────────── */
const VelocityMenuPage = () => {
  useVelocityTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const heroScale = useTransform(scrollY, [0, 200], [1, 1.08]);
  const categoryBarRef = useRef(null);

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState({});

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
    if (!selectedCategory) return menuItems;
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inCat = item.category_id === selectedCategory;
      const inSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      return inCat && inSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  /* scroll active category into view */
  useEffect(() => {
    if (!categoryBarRef.current || !selectedCategory) return;
    const btn = categoryBarRef.current.querySelector(
      `[data-cat="${selectedCategory}"]`,
    );
    if (btn)
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
  }, [selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] p-4 space-y-4">
        <div className="h-44 bg-gradient-to-b from-[#222] to-[#444] animate-pulse" />
        <Skeleton className="h-9 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#111]">
      {/* ── Hero banner ── */}
      <div className="relative h-44 overflow-hidden bg-[#1a1a1a]">
        {merchant?.branding?.banner_url ? (
          <motion.img
            src={merchant.branding.banner_url}
            alt={merchant.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ scale: heroScale }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#2a2a2a] to-[#111]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-4">
          <div
            className="inline-block self-start px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5"
            style={{ background: "var(--vel-accent)", color: "#fff" }}
          >
            Velocity
          </div>
          <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
            {merchant?.name}
          </h1>
          {merchant?.description && (
            <p className="text-white/60 text-xs mt-0.5 line-clamp-1">
              {merchant.description}
            </p>
          )}
        </div>
        <RpowerBannerBadge />
      </div>

      {/* ── Sticky search + category bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#eee] shadow-sm">
        {/* search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full h-9 pl-9 pr-9 rounded-xl bg-[#f4f4f4] border border-transparent text-sm outline-none focus:border-[var(--vel-accent)] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-black/40" />
              </button>
            )}
          </div>
        </div>
        {/* categories */}
        <div
          ref={categoryBarRef}
          className="flex gap-1 overflow-x-auto px-3 pb-2.5 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              data-cat={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? "vel-accent-bg"
                  : "bg-[#f0f0f0] text-black/70 hover:bg-[#e8e8e8]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Merchant name header ── */}
      {/* ── Item grid ── */}
      <main className="px-3 pb-28">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mt-2">
            {filteredItems.map((item, idx) => (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => setSelectedItem(item)}
                className="relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left"
                style={{ aspectRatio: "1 / 1" }}
              >
                {/* image — 70% */}
                <div className="w-full bg-[#f0f0f0]" style={{ height: "70%" }}>
                  {item.image_url && !failedImages[item.id] ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedImages((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#f0f0f0] to-[#e0e0e0]" />
                  )}
                </div>

                {/* info — 30% */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 pt-1 pb-1.5 flex items-end justify-between gap-1"
                  style={{ height: "30%" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs leading-tight line-clamp-2 text-[#111]">
                      {item.name}
                    </p>
                    <p className="text-xs font-semibold text-[var(--vel-accent)] mt-0.5">
                      ${(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                  {/* "+" button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem(item);
                    }}
                    className="shrink-0 w-7 h-7 rounded-full vel-accent-bg flex items-center justify-center shadow"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center text-black/40">
            <p className="font-semibold">No items in this category</p>
          </div>
        )}
      </main>

      {/* ── Modifier bottom sheet ── */}
      <AnimatePresence>
        {selectedItem && (
          <VelocityModifierModal
            item={selectedItem}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating cart bar ── */}
      {/* ── Floating cart (classic expandable island) ── */}
      <FloatingCart merchantSlug={merchant?.slug} />
    </div>
  );
};

export default VelocityMenuPage;
