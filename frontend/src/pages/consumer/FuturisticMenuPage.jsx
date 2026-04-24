import React, { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import { apiService } from "../../context/AppContext";
import ProductCard from "../../components/consumer/ProductCard";
import ProductModal from "../../components/consumer/ProductModal";
import CategoryNav from "../../components/consumer/CategoryNav";
import FloatingCart from "../../components/consumer/FloatingCart";
import RpowerBannerBadge from "../../components/consumer/RpowerBannerBadge";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  Phone,
  ChevronDown,
  Search,
  X,
  Utensils,
} from "lucide-react";

const getMerchantLogoUrl = (merchant) => {
  const licenseInfo = merchant?.license_info || {};
  return (
    merchant?.branding?.logo_url ||
    licenseInfo.logo_url ||
    licenseInfo.MerchantSiteLogo ||
    licenseInfo.LogoUrl ||
    licenseInfo.Logo ||
    licenseInfo.SiteLogo ||
    ""
  );
};

// Animated Background Grain
const GrainOverlay = () => (
  <div
    className="fixed inset-0 pointer-events-none z-50 opacity-[0.015]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
    }}
  />
);

// Hero Section Component
const HeroSection = ({ merchant, scrollY }) => {
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 1.1]);
  const merchantLogoUrl = getMerchantLogoUrl(merchant);

  const bannerUrl =
    merchant?.branding?.banner_url ||
    "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=1920";

  return (
    <motion.div
      style={{ y }}
      className="relative h-[30vh] min-h-[220px] overflow-hidden"
    >
      {/* Background Image with Parallax */}
      <motion.div style={{ scale }} className="absolute inset-0">
        <img
          src={bannerUrl}
          alt={merchant?.name}
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/50 via-transparent to-zinc-950/50" />
      </motion.div>

      {/* Hero Content */}
      <motion.div
        style={{ opacity }}
        className="relative h-full flex flex-col justify-end p-5 md:p-6 max-w-7xl mx-auto"
      >
        {/* Logo */}
        {merchantLogoUrl && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-3"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl">
              <img
                src={merchantLogoUrl}
                alt={merchant.name}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}

        {/* Restaurant Name */}
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl md:text-5xl font-bold text-white mb-2"
        >
          {merchant?.name}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm md:text-base text-zinc-300 mb-3 max-w-2xl"
        >
          {merchant?.description ||
            "Discover our carefully crafted menu made with passion and the finest ingredients."}
        </motion.p>

        {/* Meta Info */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center gap-3 text-xs"
        >
          {merchant?.city && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
              <MapPin className="w-4 h-4 text-orange-400" />
              <span className="text-zinc-300">
                {merchant.address_line1}, {merchant.city}, {merchant.state}
              </span>
            </div>
          )}

          {merchant?.phone && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
              <Phone className="w-4 h-4 text-orange-400" />
              <span className="text-zinc-300">{merchant.phone}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-sm rounded-full border border-orange-500/30">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 font-medium">Open Now</span>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2 text-zinc-400"
          >
            <span className="text-xs uppercase tracking-wider">
              Explore Menu
            </span>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </motion.div>

      <RpowerBannerBadge />
    </motion.div>
  );
};

// Search Bar Component
const SearchBar = ({ value, onChange, onClear }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative max-w-md mx-auto"
  >
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search menu..."
      className="
        w-full pl-12 pr-12 py-3
        bg-white/5 border border-white/10
        rounded-2xl text-white placeholder-zinc-500
        focus:outline-none focus:border-orange-500/50
        transition-all duration-300
      "
    />
    {value && (
      <button
        onClick={onClear}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-zinc-400" />
      </button>
    )}
  </motion.div>
);

// Loading Skeleton
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-zinc-950">
    {/* Hero Skeleton */}
    <div className="h-[70vh] bg-gradient-to-b from-zinc-800 to-zinc-950 animate-pulse" />

    {/* Categories Skeleton */}
    <div className="p-6">
      <div className="flex gap-3 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 w-32 bg-zinc-800 rounded-2xl animate-pulse"
          />
        ))}
      </div>
    </div>

    {/* Items Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-80 bg-zinc-800 rounded-3xl animate-pulse" />
      ))}
    </div>
  </div>
);

// Empty State
const EmptyState = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-20 text-center"
  >
    <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
      <Utensils className="w-10 h-10 text-zinc-600" />
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">No items found</h3>
    <p className="text-zinc-400">
      {message || "Try selecting a different category or search term."}
    </p>
  </motion.div>
);

// Main Menu Page Component
const FuturisticMenuPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollY } = useScroll();

  // State
  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadMenuData = useCallback(async () => {
    try {
      setLoading(true);
      const merchantRes = await apiService.getMerchantBySlug(slug);
      setMerchant(merchantRes.data);

      const categoriesRes = await apiService.getCategories(merchantRes.data.id);
      const categoriesWithCount = categoriesRes.data.map((cat) => ({
        ...cat,
        item_count: 0, // Will be calculated below
      }));

      const itemsRes = await apiService.getMenuItems(merchantRes.data.id);
      setMenuItems(itemsRes.data);

      // Calculate item count per category
      const itemCounts = {};
      itemsRes.data.forEach((item) => {
        itemCounts[item.category_id] = (itemCounts[item.category_id] || 0) + 1;
      });

      const updatedCategories = categoriesWithCount.map((cat) => ({
        ...cat,
        item_count: itemCounts[cat.id] || 0,
      }));

      setCategories(updatedCategories);

      // Select first category with items
      const firstWithItems = updatedCategories.find((c) => c.item_count > 0);
      if (firstWithItems) {
        setSelectedCategory(firstWithItems.id);
      } else if (updatedCategories.length > 0) {
        setSelectedCategory(updatedCategories[0].id);
      }
    } catch (err) {
      console.error("Failed to load menu:", err);
      toast.error("Failed to load menu");
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  // Load data
  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      !selectedCategory || item.category_id === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-zinc-950 text-white">
      {/* Grain Overlay */}
      <GrainOverlay />

      {/* Hero Section */}
      <HeroSection merchant={merchant} scrollY={scrollY} />

      {/* Sticky Navigation Section */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto py-4 space-y-4">
          {/* Search Bar */}
          <div className="px-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
            />
          </div>

          {/* Category Navigation */}
          <CategoryNav
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Section Title */}
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-white">
            {categories.find((c) => c.id === selectedCategory)?.name || "Menu"}
          </h2>
          <p className="text-zinc-400 mt-1">
            {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        </motion.div>

        {/* Items Grid */}
        {filteredItems.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  index={index}
                  onSelect={setSelectedItem}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <EmptyState
            message={
              searchQuery
                ? `No items match "${searchQuery}"`
                : "No items in this category."
            }
          />
        )}
      </div>

      {/* Product Modal */}
      <AnimatePresence>
        {selectedItem && (
          <ProductModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            merchantId={merchant?.id}
            merchantSlug={merchant?.slug}
          />
        )}
      </AnimatePresence>

      {/* Floating Cart */}
      <FloatingCart merchantSlug={merchant?.slug} />

      {/* Footer Spacer for Floating Cart */}
      <div className="h-24" />
    </div>
  );
};

export default FuturisticMenuPage;
