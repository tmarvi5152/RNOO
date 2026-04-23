import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ConsumerLayout } from "../../layouts/Layout";
import { apiService, useCart } from "../../context/AppContext";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { ScrollArea } from "../../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { Checkbox } from "../../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Minus, ShoppingCart, X, Clock } from "lucide-react";

// Helper component for menu images with fallback - only show if image exists
const MenuItemImage = ({ src, alt, className }) => {
  const [error, setError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Don't render anything if no image URL or if image failed to load
  if (!src || error) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      onLoad={() => setLoaded(true)}
      style={{ display: loaded ? "block" : "none" }}
    />
  );
};

const MenuPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, itemCount, total } = useCart();

  const [merchant, setMerchant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Item detail modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");

  useEffect(() => {
    loadMenuData();
  }, [slug]);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      const merchantRes = await apiService.getMerchantBySlug(slug);
      setMerchant(merchantRes.data);

      const categoriesRes = await apiService.getCategories(merchantRes.data.id);
      setCategories(categoriesRes.data);

      const itemsRes = await apiService.getMenuItems(merchantRes.data.id);
      setMenuItems(itemsRes.data);

      if (categoriesRes.data.length > 0) {
        setSelectedCategory(categoriesRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load menu:", err);
      toast.error("Failed to load menu");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const openItemModal = (item) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setSpecialInstructions("");

    // Initialize modifiers with defaults
    const defaults = {};
    item.modifier_groups?.forEach((group) => {
      const defaultOption = group.options.find((o) => o.is_default);
      if (group.is_required && defaultOption) {
        if (group.max_selections === 1) {
          defaults[group.id] = defaultOption.id;
        } else {
          defaults[group.id] = [defaultOption.id];
        }
      } else {
        defaults[group.id] = group.max_selections === 1 ? null : [];
      }
    });
    setSelectedModifiers(defaults);
  };

  const closeItemModal = () => {
    setSelectedItem(null);
  };

  const handleModifierChange = (
    groupId,
    optionId,
    isMultiple,
    maxSelections,
  ) => {
    setSelectedModifiers((prev) => {
      if (isMultiple) {
        const current = prev[groupId] || [];
        if (current.includes(optionId)) {
          return {
            ...prev,
            [groupId]: current.filter((id) => id !== optionId),
          };
        } else if (current.length < maxSelections) {
          return { ...prev, [groupId]: [...current, optionId] };
        }
        return prev;
      } else {
        return { ...prev, [groupId]: optionId };
      }
    });
  };

  const calculateItemTotal = () => {
    if (!selectedItem) return 0;

    let total = selectedItem.price;
    selectedItem.modifier_groups?.forEach((group) => {
      const selection = selectedModifiers[group.id];
      if (group.max_selections === 1 && selection) {
        const option = group.options.find((o) => o.id === selection);
        if (option) total += option.price;
      } else if (Array.isArray(selection)) {
        selection.forEach((optId) => {
          const option = group.options.find((o) => o.id === optId);
          if (option) total += option.price;
        });
      }
    });

    return total * itemQuantity;
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;

    // Validate required modifiers
    for (const group of selectedItem.modifier_groups || []) {
      if (group.is_required) {
        const selection = selectedModifiers[group.id];
        if (
          !selection ||
          (Array.isArray(selection) && selection.length < group.min_selections)
        ) {
          toast.error(`Please select ${group.name}`);
          return;
        }
      }
    }

    // Build modifiers array
    const modifiers = [];
    selectedItem.modifier_groups?.forEach((group) => {
      const selection = selectedModifiers[group.id];
      if (group.max_selections === 1 && selection) {
        const option = group.options.find((o) => o.id === selection);
        if (option) {
          modifiers.push({
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price: option.price,
          });
        }
      } else if (Array.isArray(selection)) {
        selection.forEach((optId) => {
          const option = group.options.find((o) => o.id === optId);
          if (option) {
            modifiers.push({
              group_id: group.id,
              group_name: group.name,
              option_id: option.id,
              option_name: option.name,
              price: option.price,
            });
          }
        });
      }
    });

    addItem(selectedItem, itemQuantity, modifiers, specialInstructions);
    toast.success(`Added ${selectedItem.name} to cart`);
    closeItemModal();
  };

  // Helper to format schedule time
  const formatScheduleTime = (start, end) => {
    if (!start || !end) return null;
    if (start === "00:00" && end === "00:00") return "All Day";
    return `${start} - ${end}`;
  };

  // Check if any categories have schedules
  const hasScheduledMenus = categories.some((c) => c.schedule_name);

  const filteredItems = selectedCategory
    ? menuItems.filter((item) => item.category_id === selectedCategory)
    : menuItems;

  const primaryColor = merchant?.branding?.primary_color || "#7C3AED";

  if (loading) {
    return (
      <ConsumerLayout merchant={null}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full rounded-xl mb-8" />
          <div className="flex gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        </div>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout merchant={merchant}>
      {/* Hero Banner */}
      <div
        className="relative h-48 md:h-64 bg-cover bg-center"
        style={{
          backgroundImage: `url(${merchant?.branding?.banner_url || "https://images.pexels.com/photos/2271107/pexels-photo-2271107.jpeg"})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">
              {merchant?.name}
            </h1>
            <p className="text-white/80 mt-2 max-w-xl">
              {merchant?.description}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Schedule notice */}
        {hasScheduledMenus && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock className="w-4 h-4" />
            <span>Menu availability based on current time</span>
          </div>
        )}

        {/* Category Pills with Schedule Info */}
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-2 pb-2">
            <TooltipProvider>
              {categories.map((category) => (
                <Tooltip key={category.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        selectedCategory === category.id ? "default" : "outline"
                      }
                      className={`rounded-full whitespace-nowrap ${
                        selectedCategory === category.id ? "shadow-lg" : ""
                      } ${category.schedule_name ? "pr-3" : ""}`}
                      style={
                        selectedCategory === category.id
                          ? { backgroundColor: primaryColor }
                          : {}
                      }
                      onClick={() => setSelectedCategory(category.id)}
                      data-testid={`category-btn-${category.id}`}
                    >
                      {category.name}
                      {category.schedule_name && (
                        <Clock className="w-3 h-3 ml-1.5 opacity-70" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  {category.schedule_name && (
                    <TooltipContent>
                      <p className="font-medium">{category.schedule_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatScheduleTime(
                          category.schedule_start,
                          category.schedule_end,
                        )}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </ScrollArea>

        {/* Menu Items Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
          layout
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => openItemModal(item)}
                  data-testid={`menu-item-${item.id}`}
                >
                  {/* Only show image container if item has an image */}
                  {item.image_url && (
                    <div className="relative h-48 overflow-hidden bg-gray-100">
                      <MenuItemImage
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge variant="secondary" className="text-lg">
                            Unavailable
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent
                    className={`p-4 ${!item.image_url ? "border-l-4 border-primary" : ""}`}
                  >
                    {/* Show unavailable badge at top if no image */}
                    {!item.image_url && !item.is_available && (
                      <Badge variant="secondary" className="mb-2">
                        Unavailable
                      </Badge>
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-heading font-semibold text-lg">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      </div>
                      <span
                        className="font-bold text-lg"
                        style={{ color: primaryColor }}
                      >
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    {item.modifier_groups?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Customizable • {item.modifier_groups.length} options
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items in this category</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button (Mobile) */}
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-4 left-4 right-4 md:hidden z-40"
        >
          <Button
            className="w-full h-14 rounded-full shadow-2xl"
            style={{ backgroundColor: primaryColor }}
            onClick={() => navigate(`/order/${slug}/cart`)}
            data-testid="mobile-cart-btn"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            View Cart ({itemCount}) • ${total.toFixed(2)}
          </Button>
        </motion.div>
      )}

      {/* Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={closeItemModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          {selectedItem && (
            <>
              {/* Image - only show if item has an image */}
              {selectedItem.image_url ? (
                <div className="relative h-48 flex-shrink-0 bg-gray-100">
                  <MenuItemImage
                    src={selectedItem.image_url}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full"
                    onClick={closeItemModal}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <div className="relative flex-shrink-0 p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={closeItemModal}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <DialogHeader className="text-left">
                    <DialogTitle className="font-heading text-2xl">
                      {selectedItem.name}
                    </DialogTitle>
                    <p className="text-gray-500 mt-1">
                      {selectedItem.description}
                    </p>
                    <p
                      className="text-xl font-bold mt-2"
                      style={{ color: primaryColor }}
                    >
                      ${selectedItem.price.toFixed(2)}
                    </p>
                  </DialogHeader>

                  {/* Modifier Groups */}
                  <div className="mt-6 space-y-6">
                    {selectedItem.modifier_groups?.map((group) => (
                      <div key={group.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{group.name}</h4>
                          {group.is_required && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {group.min_selections > 0 &&
                            `Min: ${group.min_selections} `}
                          {group.max_selections > 1 &&
                            `Max: ${group.max_selections}`}
                        </p>

                        {group.max_selections === 1 ? (
                          <RadioGroup
                            value={selectedModifiers[group.id] || ""}
                            onValueChange={(value) =>
                              handleModifierChange(group.id, value, false)
                            }
                          >
                            {group.options.map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem
                                    value={option.id}
                                    id={option.id}
                                  />
                                  <Label
                                    htmlFor={option.id}
                                    className="cursor-pointer"
                                  >
                                    {option.name}
                                  </Label>
                                </div>
                                {option.price > 0 && (
                                  <span className="text-sm text-gray-500">
                                    +${option.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </RadioGroup>
                        ) : (
                          <div className="space-y-2">
                            {group.options.map((option) => (
                              <div
                                key={option.id}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={option.id}
                                    checked={(
                                      selectedModifiers[group.id] || []
                                    ).includes(option.id)}
                                    onCheckedChange={() =>
                                      handleModifierChange(
                                        group.id,
                                        option.id,
                                        true,
                                        group.max_selections,
                                      )
                                    }
                                  />
                                  <Label
                                    htmlFor={option.id}
                                    className="cursor-pointer"
                                  >
                                    {option.name}
                                  </Label>
                                </div>
                                {option.price > 0 && (
                                  <span className="text-sm text-gray-500">
                                    +${option.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Special Instructions */}
                    <div className="space-y-2">
                      <Label>Special Instructions</Label>
                      <Textarea
                        placeholder="Any allergies or special requests?"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t p-4 flex-shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  {/* Quantity */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() =>
                        setItemQuantity(Math.max(1, itemQuantity - 1))
                      }
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold">
                      {itemQuantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setItemQuantity(itemQuantity + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Add to Cart Button */}
                  <Button
                    className="flex-1 h-12"
                    style={{ backgroundColor: primaryColor }}
                    onClick={handleAddToCart}
                    data-testid="add-to-cart-btn"
                  >
                    Add to Cart • ${calculateItemTotal().toFixed(2)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ConsumerLayout>
  );
};

export default MenuPage;
