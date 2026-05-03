import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, X, Plus, Minus, ClipboardList } from "lucide-react";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import { toast } from "sonner";
import { useJukeboxTheme } from "./JukeboxTheme";

const resolveMenuImageUrl = (rawUrl) => {
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`;
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return rawUrl;

  if (rawUrl.startsWith("/")) {
    return `${window.location.origin}${rawUrl}`;
  }

  const apiBase = process.env.REACT_APP_API_URL || "";
  if (apiBase) {
    return `${apiBase.replace(/\/$/, "")}/${rawUrl.replace(/^\//, "")}`;
  }

  return rawUrl;
};

const MenuItemImage = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = useMemo(() => resolveMenuImageUrl(src), [src]);

  if (!normalizedSrc || failed) {
    return null;
  }

  return (
    <div className="juke-polaroid w-[92px] sm:w-[102px] shrink-0 self-center">
      <div className="h-[92px] sm:h-[102px] rounded-[3px] overflow-hidden bg-white/70">
        <img
          src={normalizedSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
};

const JukeboxItemModal = ({ item, merchantId, merchantSlug, onClose }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!item) return;
    const defaults = {};
    item.modifier_groups?.forEach((group) => {
      const defaultOption = group.options?.find((o) => o.is_default);
      if (group.max_selections === 1)
        defaults[group.id] = defaultOption?.id || null;
      else defaults[group.id] = defaultOption?.id ? [defaultOption.id] : [];
    });
    setSelectedModifiers(defaults);
    setSpecialInstructions("");
    setQuantity(1);
    setAttempted(false);
  }, [item]);

  const isGroupSatisfied = (group) => {
    if (!group?.is_required) return true;
    const selected = selectedModifiers[group.id];
    const min = group.min_selections || 1;
    if (group.max_selections === 1) return Boolean(selected);
    return Array.isArray(selected) && selected.length >= min;
  };

  const selectedModifierTotal = useMemo(() => {
    if (!item) return 0;
    let total = 0;
    item.modifier_groups?.forEach((group) => {
      const selected = selectedModifiers[group.id];
      if (Array.isArray(selected)) {
        selected.forEach((id) => {
          const option = group.options?.find((o) => o.id === id);
          if (option) total += option.price || 0;
        });
      } else if (selected) {
        const option = group.options?.find((o) => o.id === selected);
        if (option) total += option.price || 0;
      }
    });
    return total;
  }, [item, selectedModifiers]);

  const onModifier = (group, optionId) => {
    setSelectedModifiers((prev) => {
      if (group.max_selections === 1) return { ...prev, [group.id]: optionId };
      const current = prev[group.id] || [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= (group.max_selections || 99)) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const onAdd = () => {
    setAttempted(true);
    for (const group of item.modifier_groups || []) {
      if (group.is_required && !isGroupSatisfied(group)) {
        toast.error(`Please make a selection for ${group.name}`);
        return;
      }
    }

    const modifiers = [];
    item.modifier_groups?.forEach((group) => {
      const selected = selectedModifiers[group.id];
      const pushOption = (optionId) => {
        const option = group.options?.find((o) => o.id === optionId);
        if (!option) return;
        modifiers.push({
          group_id: group.id,
          group_name: group.name,
          option_id: option.id,
          option_name: option.name,
          price: option.price || 0,
          plu: option.plu || "",
          shepherd_pos_id: option.shepherd_pos_id || "",
        });
      };

      if (Array.isArray(selected)) selected.forEach(pushOption);
      else if (selected) pushOption(selected);
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full max-w-2xl juke-modal rounded-t-2xl sm:rounded-xl overflow-hidden">
        <div className="juke-modal-inner p-4 sm:p-5 max-h-[88vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-3xl juke-item-title">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-black/70 mt-1">{item.description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full juke-chrome-edge grid place-items-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {item.modifier_groups?.map((group) => {
              const isSingle = group.max_selections === 1;
              const invalid = attempted && !isGroupSatisfied(group);

              return (
                <div
                  key={group.id}
                  className={`rounded-lg p-3 border ${invalid ? "border-red-500" : "border-black/15"}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold">{group.name}</p>
                    {group.is_required && (
                      <span className="text-[11px] uppercase tracking-wide text-red-700">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {group.options?.map((option) => {
                      const checked = isSingle
                        ? selectedModifiers[group.id] === option.id
                        : (selectedModifiers[group.id] || []).includes(
                            option.id,
                          );
                      return (
                        <label
                          key={option.id}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              className="juke-choice"
                              type={isSingle ? "radio" : "checkbox"}
                              checked={checked}
                              onChange={() => onModifier(group, option.id)}
                              name={group.id}
                            />
                            <span>{option.name}</span>
                          </div>
                          <span className="text-sm text-black/70">
                            {option.price
                              ? `+$${option.price.toFixed(2)}`
                              : "incl"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {invalid && (
                    <p className="mt-2 text-xs text-red-700 font-semibold">
                      Please make a selection
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium">Special Instructions</label>
            <textarea
              rows={3}
              className="w-full mt-1 rounded-md border border-black/20 p-2"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border border-black/20 bg-white">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 grid place-items-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold">{quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 grid place-items-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button onClick={onAdd} className="juke-add-btn flex-1 h-11">
              Add to order - ${lineTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FloatingPad = ({ slug }) => {
  const navigate = useNavigate();
  const {
    items,
    getSubtotal,
    getTax,
    getTotal,
    updateQuantity,
    removeItem,
    getItemCount,
  } = useCartStore();

  return (
    <aside className="juke-pad h-fit sticky top-3 p-3">
      <div className="juke-clipboard" />
      <p className="text-3xl juke-item-title mt-2">Order Pad</p>
      <div className="max-h-[340px] overflow-y-auto mt-2 pr-1 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-black/60">No songs queued yet.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="juke-pad-item pb-2">
            <div className="flex justify-between gap-2 items-start">
              <p className="juke-pad-item-name leading-tight">
                {item.quantity} {item.name}
              </p>
              <p className="juke-pad-item-price text-sm">
                ${Number(item.totalPrice || 0).toFixed(2)}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <button
                aria-label="Decrease quantity"
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="w-11 h-11 rounded-md border border-black/25 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                -
              </button>
              <button
                aria-label="Increase quantity"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="w-11 h-11 rounded-md border border-black/25 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
              >
                +
              </button>
              <button
                aria-label="Remove item"
                onClick={() => removeItem(item.id)}
                className="ml-auto w-11 h-11 rounded-md border border-red-300 bg-red-100 text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-sm space-y-1 font-mono">
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

      <button
        onClick={() => navigate(`/checkout/${slug}`)}
        disabled={getItemCount() === 0}
        className="juke-ring-btn w-full mt-3 h-12 text-lg"
      >
        Ring it up!
      </button>
    </aside>
  );
};

const JukeboxMenuPage = () => {
  useJukeboxTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const { getTotal, getItemCount } = useCartStore();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const merchantRes = await apiService.getMerchantBySlug(slug);
      const merchantData = merchantRes.data;
      setMerchant(merchantData);

      const [catRes, itemRes] = await Promise.all([
        apiService.getCategories(merchantData.id),
        apiService.getMenuItems(merchantData.id),
      ]);

      const catList = catRes.data || [];
      setCategories(catList);
      setMenuItems(itemRes.data || []);
      if (catList.length) setSelectedCategory(catList[0].id);
    } catch (err) {
      console.error("Failed to load jukebox template menu", err);
      toast.error("Unable to load menu");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inCategory =
        !selectedCategory || item.category_id === selectedCategory;
      const inSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  }, [menuItems, selectedCategory, search]);

  if (loading) {
    return <div className="juke-shell px-4 py-8">Loading jukebox menu...</div>;
  }

  return (
    <div className="juke-shell px-3 py-3">
      <div className="max-w-[1460px] mx-auto">
        <header className="juke-hero p-4 rounded-lg mb-3 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/80">
                Template # 8: Jukebox (Vintage Diner)
              </p>
              <h1 className="juke-neon text-5xl sm:text-6xl leading-none mt-2">
                {merchant?.name || "Vintage Diner"}
              </h1>
              <p className="mt-2 text-white/85 font-semibold">
                {merchant?.address ||
                  merchant?.full_address ||
                  "Open late under the neon lights"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-white/80">
                Order
              </p>
              <p className="text-4xl text-white font-black">
                ${getTotal().toFixed(2)}
              </p>
              <button
                onClick={() => navigate(`/order/${slug}/cart`)}
                className="juke-ring-btn mt-2 px-4 py-2 text-sm"
              >
                Open Pad ({getItemCount()})
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
          <section>
            <div className="juke-chrome-edge p-2 rounded-md">
              <div className="bg-white border border-black/25 h-12 rounded px-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-black/55" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="juke-checker mt-3 mb-2 rounded" />
            <div
              className="juke-cat-btn-strip flex gap-2 overflow-x-auto pb-2"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`juke-cat-btn h-9 px-4 rounded whitespace-nowrap shrink-0 ${selectedCategory === cat.id ? "active" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="juke-checker mt-2 mb-3 rounded" />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredItems.map((item) => (
                <article key={item.id} className="juke-item-card p-2.5">
                  <div className="flex items-start gap-3 min-h-[110px]">
                    <MenuItemImage src={item.image_url} alt={item.name} />
                    <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch py-0.5">
                      <div>
                        {!item.image_url && (
                          <p className="juke-no-photo-chip text-[10px] uppercase tracking-[0.18em] font-semibold mb-1.5">
                            House Favorite
                          </p>
                        )}
                        <p className="juke-item-title text-[1.7rem] leading-none pr-1">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-black/65 mt-1.5 line-clamp-3 max-w-[20ch] sm:max-w-none">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm">
                          ${Number(item.price || 0).toFixed(2)}
                        </span>
                        <button
                          className="juke-add-btn h-8 px-3 text-xs"
                          onClick={() => setSelectedItem(item)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="hidden xl:block">
            <FloatingPad slug={slug} />
          </div>
        </div>

        <div className="xl:hidden fixed bottom-4 right-4 z-30">
          <button
            onClick={() => navigate(`/order/${slug}/cart`)}
            className="juke-ring-btn h-14 px-5 inline-flex items-center gap-2"
          >
            <ClipboardList className="w-5 h-5" />
            Ring it up (${getTotal().toFixed(2)})
          </button>
        </div>
      </div>

      {selectedItem && merchant?.id && (
        <JukeboxItemModal
          item={selectedItem}
          merchantId={merchant.id}
          merchantSlug={slug}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default JukeboxMenuPage;
