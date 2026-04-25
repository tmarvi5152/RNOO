import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useCartStore } from "../../stores/cartStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Skeleton } from "../../components/ui/skeleton";
import RpowerBannerBadge from "../../components/consumer/RpowerBannerBadge";
import { Minus, Plus, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useVantageTheme } from "./VantageTheme";

const VantageMenuModal = ({ item, merchantId, merchantSlug, onClose }) => {
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

  const handleModifierChange = (
    groupId,
    optionId,
    isMultiple,
    maxSelections,
  ) => {
    setSelectedModifiers((prev) => {
      if (!isMultiple) {
        return { ...prev, [groupId]: optionId };
      }
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

  const isGroupSatisfied = (group) => {
    if (!group?.is_required) return true;
    const selected = selectedModifiers[group.id];
    const min = group.min_selections || 1;
    if (group.max_selections === 1) return Boolean(selected);
    return Array.isArray(selected) && selected.length >= min;
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
      const selected = selectedModifiers[group.id];
      if (Array.isArray(selected)) {
        selected.forEach((id) => {
          const option = group.options?.find((o) => o.id === id);
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
        });
      } else if (selected) {
        const option = group.options?.find((o) => o.id === selected);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="relative w-full max-w-2xl h-[92vh] overflow-hidden vantage-surface flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-white/80 p-2 hover:bg-white"
        >
          <X className="w-4 h-4" />
        </button>

        {!imageFailed && item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-60 object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-24 bg-black/5" />
        )}

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <h3 className="text-3xl font-light">{item.name}</h3>
          <p className="text-black/65 mt-2">
            {item.description ||
              "Prepared fresh and designed for a clean premium order flow."}
          </p>
          <p className="mt-3 text-lg font-semibold vantage-accent">
            ${(item.price || 0).toFixed(2)}
          </p>

          <div className="space-y-5 mt-6">
            {item.modifier_groups?.map((group) => {
              const isSingle = group.max_selections === 1;
              const satisfied = isGroupSatisfied(group);
              return (
                <div
                  key={group.id}
                  className={`vantage-surface p-4 ${
                    attempted && !satisfied
                      ? "border border-red-300 bg-red-50"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{group.name}</h4>
                    {group.is_required && (
                      <Badge variant="outline">Required</Badge>
                    )}
                  </div>
                  <p className="text-xs text-black/50 mb-3">
                    {group.min_selections ? `Min ${group.min_selections} ` : ""}
                    {group.max_selections > 1
                      ? `Max ${group.max_selections}`
                      : "Choose one"}
                  </p>
                  {attempted && !satisfied && (
                    <p className="text-xs font-medium text-red-600 mb-3">
                      Please choose at least {group.min_selections || 1} option
                      {(group.min_selections || 1) > 1 ? "s" : ""}.
                    </p>
                  )}

                  {isSingle ? (
                    <RadioGroup
                      value={selectedModifiers[group.id] || ""}
                      onValueChange={(val) =>
                        handleModifierChange(
                          group.id,
                          val,
                          false,
                          group.max_selections,
                        )
                      }
                    >
                      {group.options?.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center justify-between py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <Label htmlFor={option.id}>{option.name}</Label>
                          </div>
                          {!!option.price && (
                            <span className="text-sm text-black/55">
                              +${option.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {group.options?.map((option) => {
                        const checked = (
                          selectedModifiers[group.id] || []
                        ).includes(option.id);
                        return (
                          <div
                            key={option.id}
                            className="flex items-center justify-between py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={option.id}
                                checked={checked}
                                onCheckedChange={() =>
                                  handleModifierChange(
                                    group.id,
                                    option.id,
                                    true,
                                    group.max_selections,
                                  )
                                }
                              />
                              <Label htmlFor={option.id}>{option.name}</Label>
                            </div>
                            {!!option.price && (
                              <span className="text-sm text-black/55">
                                +${option.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <div>
              <Label>Special Instructions</Label>
              <Textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-black/10 p-4 flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-black/5 rounded-full px-2 py-1">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center text-sm font-medium">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <Button onClick={handleAdd} className="flex-1 rounded-full h-11">
            Add to Cart • $
            {((item.price || 0) + selectedModifierTotal) * quantity}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const VantageMenuPage = () => {
  useVantageTheme();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { getItemCount, getTotal } = useCartStore();

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failedItemImages, setFailedItemImages] = useState({});

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

  const itemCount = getItemCount();
  const total = getTotal();

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-10">
        <Skeleton className="h-72 w-full rounded-3xl mb-8" />
        <div className="flex gap-3 mb-6">
          {[1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-10 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <Skeleton key={k} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f5] text-[#141414]">
      <header className="relative h-[30vh] min-h-[220px] overflow-hidden">
        <img
          src={
            merchant?.branding?.banner_url ||
            "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=2000"
          }
          alt={merchant?.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col justify-end pb-6 text-white"
        >
          <Badge className="w-fit bg-white/20 text-white border-white/40 mb-2 uppercase tracking-[0.18em]">
            Vantage
          </Badge>
          <h1 className="text-3xl md:text-5xl font-light uppercase tracking-[0.08em]">
            {merchant?.name}
          </h1>
          <p className="mt-2 max-w-2xl text-white/85 italic text-xs md:text-sm">
            {merchant?.description ||
              "A premium, image-forward menu experience curated for fast, elegant ordering."}
          </p>
        </motion.div>

        <RpowerBannerBadge />
      </header>

      <div className="sticky top-0 z-30 bg-[#f4f1ea]/95 backdrop-blur-lg border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
          <div className="relative max-w-lg">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-black/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full h-11 pl-11 pr-4 bg-white border border-black/10 rounded-full text-sm outline-none focus:border-black/25"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`whitespace-nowrap px-4 py-2 text-sm rounded-full border transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-black text-white border-black"
                    : "bg-white border-black/15 text-black/75 hover:border-black/35"
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-light tracking-wide">
            {categories.find((c) => c.id === selectedCategory)?.name || "Menu"}
          </h2>
          <span className="text-sm text-black/65">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredItems.map((item, idx) => (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => setSelectedItem(item)}
                className="text-left vantage-surface vantage-card-hover overflow-hidden"
              >
                {item.image_url && !failedItemImages[item.id] && (
                  <div className="h-48 overflow-hidden bg-black/5">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedItemImages((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-medium">{item.name}</h3>
                    <span className="text-sm font-semibold">
                      ${item.price?.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-black/65 line-clamp-2">
                    {item.description ||
                      "Chef-crafted selection prepared to order."}
                  </p>
                  <div className="mt-4 flex items-center text-xs text-black/60">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    {item.modifier_groups?.length
                      ? `${item.modifier_groups.length} customization group${item.modifier_groups.length === 1 ? "" : "s"}`
                      : "Simple quick-add item"}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="vantage-surface p-10 text-center">
            <h3 className="text-xl font-medium">No matching items</h3>
            <p className="text-black/60 mt-2">
              Try a different category or search term.
            </p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedItem && (
          <VantageMenuModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
          />
        )}
      </AnimatePresence>

      {itemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:w-[330px]">
          <button
            onClick={() => navigate(`/order/${slug}/cart`)}
            className="w-full h-14 rounded-2xl bg-black text-white px-4 flex items-center justify-between shadow-2xl"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-sm">{itemCount} items</span>
            </span>
            <span className="font-semibold">
              View Cart • ${total.toFixed(2)}
            </span>
          </button>
        </div>
      )}
      <div className="h-28" />
    </div>
  );
};

export default VantageMenuPage;
