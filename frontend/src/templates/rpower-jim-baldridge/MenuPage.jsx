import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { apiService } from "../../context/AppContext";
import RjbProductModal from "./RjbProductModal";
import { useCartStore } from "../../stores/cartStore";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  persistRpowerJimBaldridgeLegacyMode,
  useRpowerJimBaldridgeTheme,
} from "./Theme";
import LegacyLockup from "./LegacyLockup";
import RpowerBannerBadge from "../../components/consumer/RpowerBannerBadge";

const LEGACY_WIN98_CLOUD_BANNER =
  "https://images.pexels.com/photos/531756/pexels-photo-531756.jpeg?auto=compress&cs=tinysrgb&w=2200";

const RpowerJimBaldridgeMenuPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    items,
    getItemCount,
    getSubtotal,
    getTax,
    getTotal,
    removeModifier,
    updateSpecialInstructions,
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
  const cartCount = getItemCount();
  const cartSubtotal = getSubtotal();
  const cartTax = getTax();
  const cartTotal = getTotal();
  const legacyMode = Boolean(merchant?.shepherd_config?.rjb_legacy_mode);
  const bannerImageSrc = legacyMode
    ? LEGACY_WIN98_CLOUD_BANNER
    : merchant?.branding?.banner_url ||
      "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=2000";

  useRpowerJimBaldridgeTheme(legacyMode);

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

  useEffect(() => {
    if (selectedItem) {
      setCartOpen(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (merchant) {
      persistRpowerJimBaldridgeLegacyMode(legacyMode);
    }
  }, [merchant, legacyMode]);

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

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-10 text-white">
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
    <div className="min-h-screen bg-[#0f1115] text-white">
      <header className="relative h-[30vh] min-h-[220px] overflow-hidden border-b border-[#f6c45344]">
        <img
          src={bannerImageSrc}
          alt={merchant?.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,12,0.2)_0%,rgba(10,10,12,0.88)_100%)]" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col justify-end pb-6 text-white"
        >
          <Badge className="w-fit rjb-pill text-[#f6c453] border-[#f6c45377] bg-[#f6c45314] mb-2 uppercase tracking-[0.18em]">
            {legacyMode ? "RPOWER Legacy Mode" : "RPOWER Classic Tribute"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-light tracking-[0.04em]">
            {merchant?.name}
          </h1>
          <p className="mt-2 max-w-3xl text-white/80 text-xs md:text-sm">
            {legacyMode
              ? "A formal memorial storefront preserving the original RPOWER service tone."
              : "A classic tribute storefront honoring Jim Baldridge through timeless hospitality design."}
          </p>
          {legacyMode ? <LegacyLockup className="mt-2" compact /> : null}
        </motion.div>

        <RpowerBannerBadge />
      </header>

      <div className="sticky top-0 z-30 bg-[#11151b]/95 backdrop-blur-lg border-b border-[#f6c45333]">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
          <div className="relative max-w-lg">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/55" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full h-11 pl-11 pr-4 bg-[#1a2028] border border-[#f6c4532f] rounded-full text-sm text-white outline-none focus:border-[#f6c45388]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`whitespace-nowrap px-4 py-2 text-sm rounded-full border transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[#d72638] text-white border-[#d72638]"
                    : "bg-[#1b2029] border-[#f6c45330] text-white/80 hover:border-[#f6c45388]"
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
          <span className="text-sm text-white/65">
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
                className="text-left rjb-surface rjb-card-hover overflow-hidden"
              >
                <div className="flex items-start gap-3 p-3">
                  <div className="w-[130px] h-[130px] shrink-0 overflow-hidden rounded-md border border-[#e8ba533a] bg-black/30">
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
                      <div className="w-full h-full grid place-items-center text-white/40 text-xs px-2 text-center">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 h-[130px] flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-medium leading-tight pr-2">
                        {item.name}
                      </h3>
                      <span className="text-sm font-semibold text-[#f6c453] shrink-0">
                        ${item.price?.toFixed(2)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-white/65 line-clamp-3">
                      {item.description || "Crafted fresh and made to order."}
                    </p>

                    <div className="mt-auto pt-2 flex items-center text-[11px] text-white/60">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#f6c453]" />
                      {item.modifier_groups?.length
                        ? `${item.modifier_groups.length} customization group${
                            item.modifier_groups.length === 1 ? "" : "s"
                          }`
                        : "Quick add available"}
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="rjb-surface p-10 text-center">
            <h3 className="text-xl font-medium">No matching items</h3>
            <p className="text-white/65 mt-2">
              Try another category or search term.
            </p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selectedItem && (
          <RjbProductModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
          />
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-6 pb-24 pt-4">
        <div className="rjb-surface p-4">
          {legacyMode ? (
            <LegacyLockup />
          ) : (
            <p className="text-sm text-white/60">
              RPOWER Jim Baldridge Version
            </p>
          )}
        </div>
      </footer>

      {cartCount > 0 && !selectedItem && (
        <div className="rjb-floating-cart fixed right-4 bottom-5 z-40 w-[min(430px,calc(100%-1rem))]">
          <motion.button
            type="button"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            onClick={() => setCartOpen((v) => !v)}
            className="rjb-floating-toggle w-full rounded-[22px] border border-[#e8ba5388] bg-[linear-gradient(180deg,#252f3f_0%,#151b24_46%,#0e1218_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-8px_18px_rgba(0,0,0,0.35)] px-5 py-4 text-left"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-xl bg-[linear-gradient(180deg,#d39f43_0%,#9f6d1d_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_18px_rgba(0,0,0,0.35)] grid place-items-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-[#121212]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#e8ba53]/85">
                    {legacyMode ? "Legacy Cart" : "Classic Cart"}
                  </p>
                  <p className="font-medium text-white truncate">
                    {cartCount} item{cartCount === 1 ? "" : "s"} in ticket
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-white/65">
                  Tap to {cartOpen ? "hide" : "open"}
                </p>
                <p className="text-xl font-semibold text-[#e8ba53]">
                  ${cartTotal.toFixed(2)}
                </p>
              </div>
            </div>
          </motion.button>

          <AnimatePresence>
            {cartOpen && (
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="rjb-floating-drawer mt-3 rounded-2xl border border-[#e8ba5366] bg-[linear-gradient(180deg,#18202c_0%,#121821_100%)] shadow-[0_24px_44px_rgba(0,0,0,0.55)]"
              >
                <div className="p-4 flex items-center justify-between border-b border-[#e8ba5333]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#e8ba53]">
                      Live Ticket Drawer
                    </p>
                    <p className="text-sm text-white/75">
                      Adjust quantities without leaving menu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="w-8 h-8 rounded-md bg-black/25 text-white/70 hover:text-white grid place-items-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-[45vh] overflow-y-auto p-4 space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#e8ba532f] bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {item.name}
                          </p>
                          {item.modifiers?.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.modifiers.map((m, idx) => (
                                <button
                                  key={`${item.id}-mod-${idx}`}
                                  type="button"
                                  onClick={() => removeModifier(item.id, idx)}
                                  className="inline-flex items-center gap-1 text-[11px] rounded-full border border-[#e8ba5344] px-2 py-0.5 text-white/75 hover:text-white hover:border-[#e8ba5385]"
                                  title="Remove modifier"
                                >
                                  <span>{m.option_name || m.name}</span>
                                  <X className="w-3 h-3" />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-white/45 hover:text-red-300"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center gap-1 rounded-md border border-[#e8ba533a] bg-[#0d1219] px-1.5 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-7 h-7 rounded-sm bg-[#1d2633] hover:bg-[#253244] grid place-items-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-7 h-7 rounded-sm bg-[#1d2633] hover:bg-[#253244] grid place-items-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-semibold text-[#e8ba53]">
                          ${item.totalPrice.toFixed(2)}
                        </p>
                      </div>

                      <div className="mt-3">
                        <label className="text-[11px] uppercase tracking-[0.1em] text-white/50 block mb-1">
                          Special Instructions
                        </label>
                        <input
                          value={item.specialInstructions || ""}
                          onChange={(e) =>
                            updateSpecialInstructions(item.id, e.target.value)
                          }
                          placeholder="No onions, extra sauce, etc."
                          className="w-full h-9 px-2.5 rounded-md border border-[#e8ba5333] bg-[#0d1219] text-sm text-white/90 placeholder:text-white/35 outline-none focus:border-[#e8ba5385]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-[#e8ba5333]">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-white/70">
                      <span>Subtotal</span>
                      <span>${cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Tax</span>
                      <span>${cartTax.toFixed(2)}</span>
                    </div>
                  </div>
                  <Separator className="my-3 bg-white/15" />
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-[#e8ba53]">
                      ${cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-md border-[#e8ba5350]"
                      onClick={() => setCartOpen(false)}
                    >
                      Continue Browsing
                    </Button>
                    <Button
                      className="rounded-md bg-[#cf2030] hover:bg-[#b11928]"
                      onClick={() =>
                        navigate(`/order/${merchant?.slug || slug}/cart`)
                      }
                    >
                      Review Full Cart
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="h-28" />
    </div>
  );
};

export default RpowerJimBaldridgeMenuPage;
