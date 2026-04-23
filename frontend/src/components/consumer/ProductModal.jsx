import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Sparkles, Check, ChevronDown } from "lucide-react";
import { useCartStore } from "../../stores/cartStore";
import { toast } from "sonner";

const ProductModal = ({ item, onClose, merchantId, merchantSlug }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [imageFailed, setImageFailed] = useState(false);

  // Initialize modifiers with defaults
  useEffect(() => {
    if (item?.modifier_groups) {
      const defaults = {};
      const expanded = {};
      item.modifier_groups.forEach((group) => {
        expanded[group.id] = true; // Expand all by default
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
      setExpandedGroups(expanded);
    }
  }, [item]);

  useEffect(() => {
    setImageFailed(false);
  }, [item?.id, item?.image_url]);

  const handleModifierChange = (
    groupId,
    optionId,
    isMultiple,
    maxSelections,
    allowDuplicates = false,
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
        // Single-select mode
        const current = prev[groupId];

        // If this option allows duplicates (e.g., "NO~" prefix modifiers),
        // convert to array mode and always ADD (never toggle off)
        if (allowDuplicates) {
          // Convert to array if needed
          const currentArray = Array.isArray(current)
            ? current
            : current
              ? [current]
              : [];

          // Always add to selections (don't toggle)
          return { ...prev, [groupId]: [...currentArray, optionId] };
        }

        // Normal single-select: replace current selection
        return { ...prev, [groupId]: optionId };
      }
    });
  };

  const calculateTotal = () => {
    if (!item) return 0;
    let total = item.price;

    // Build ordered list of all selected modifiers across all groups
    const orderedModifiers = [];
    item.modifier_groups?.forEach((group) => {
      const selection = selectedModifiers[group.id];

      if (Array.isArray(selection)) {
        selection.forEach((optId) => {
          const option = group.options.find((o) => o.id === optId);
          if (option) orderedModifiers.push(option);
        });
      } else if (selection) {
        const option = group.options.find((o) => o.id === selection);
        if (option) orderedModifiers.push(option);
      }
    });

    // Apply pricing rules based on PLU codes in selection order
    for (let i = 0; i < orderedModifiers.length; i++) {
      const modifier = orderedModifiers[i];
      const prevModifier = i > 0 ? orderedModifiers[i - 1] : null;

      // Check if previous modifier makes this one free
      const isFree = prevModifier && prevModifier.plu === "NO";

      if (!isFree) {
        total += modifier.price;
      }
    }

    return total * quantity;
  };

  const handleAddToCart = () => {
    // Validate required modifiers
    for (const group of item.modifier_groups || []) {
      if (group.is_required) {
        const selection = selectedModifiers[group.id];
        if (
          !selection ||
          (Array.isArray(selection) &&
            selection.length < (group.min_selections || 1))
        ) {
          toast.error(`Please select ${group.name}`);
          return;
        }
      }
    }

    // Build modifiers array (maintaining selection order)
    const modifiers = [];
    item.modifier_groups?.forEach((group) => {
      const selection = selectedModifiers[group.id];

      // Handle both single-select and array selections
      if (Array.isArray(selection)) {
        // Array mode: iterate in order and add each selection
        selection.forEach((optId) => {
          const option = group.options.find((o) => o.id === optId);
          if (option) {
            modifiers.push({
              group_id: group.id,
              group_name: group.name,
              option_id: option.id,
              option_name: option.name,
              price: option.price,
              plu: option.plu,
              shepherd_pos_id: option.shepherd_pos_id,
            });
          }
        });
      } else if (selection) {
        // Single selection mode
        const option = group.options.find((o) => o.id === selection);
        if (option) {
          modifiers.push({
            group_id: group.id,
            group_name: group.name,
            option_id: option.id,
            option_name: option.name,
            price: option.price,
            plu: option.plu,
            shepherd_pos_id: option.shepherd_pos_id,
          });
        }
      }
    });

    // Apply PLU-based pricing logic and combine prefix modifiers (except NO~)
    const finalModifiers = [];
    let i = 0;

    while (i < modifiers.length) {
      const current = modifiers[i];
      const next = i + 1 < modifiers.length ? modifiers[i + 1] : null;

      // Check if current modifier is a prefix modifier (ends with ~)
      const isPrefixModifier =
        current.option_name && current.option_name.trim().endsWith("~");
      const isNOModifier = current.plu === "NO";

      if (isPrefixModifier && !isNOModifier && next) {
        // Combine prefix modifier with next item (except NO~)
        const prefixName = current.option_name.replace(/~\s*$/, "").trim(); // Remove trailing ~
        const combinedName = `${prefixName} ${next.option_name}`;
        const combinedPrice = current.price + next.price;

        finalModifiers.push({
          group_id: current.group_id,
          group_name: current.group_name,
          option_id: current.option_id,
          option_name: combinedName,
          price: combinedPrice,
          plu: "", // No PLU for combined modifiers
          shepherd_pos_id: current.shepherd_pos_id,
          combined: true, // Flag to indicate this was combined
          original_modifiers: [current, next], // Keep reference to originals
        });

        i += 2; // Skip both current and next
      } else if (isNOModifier && next) {
        // NO~ makes next item free but sends separately
        finalModifiers.push(current);

        finalModifiers.push({
          ...next,
          original_price: next.price,
          price: 0,
          price_override_reason: "NO modifier",
        });

        i += 2; // Skip both
      } else {
        // Regular modifier, add as-is
        finalModifiers.push(current);
        i++;
      }
    }

    addItem(
      item,
      quantity,
      finalModifiers,
      specialInstructions,
      merchantId,
      merchantSlug,
    );

    toast.success(
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-orange-400" />
        <span>Added {item.name} to your order!</span>
      </div>,
    );

    onClose();
  };

  const isOptionSelected = (groupId, optionId, isMultiple) => {
    const selection = selectedModifiers[groupId];
    if (isMultiple) {
      return (selection || []).includes(optionId);
    }
    // Handle single-select that might have been converted to array for allow_duplicates
    if (Array.isArray(selection)) {
      return selection.includes(optionId);
    }
    return selection === optionId;
  };

  const hasImage = Boolean(
    item?.image_url && !item?.image_url.includes("placeholder") && !imageFailed,
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      >
        <motion.div
          layoutId={`product-${item.id}`}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="
            relative w-full max-w-2xl max-h-[90vh]
            bg-zinc-900 border border-white/10
            rounded-3xl overflow-hidden
            shadow-2xl shadow-black/50
          "
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="
              absolute top-4 right-4 z-20
              w-10 h-10 rounded-full
              bg-black/50 backdrop-blur-sm
              border border-white/10
              flex items-center justify-center
              hover:bg-white/10 transition-colors
            "
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Scrollable Content */}
          <div className="max-h-[90vh] overflow-y-auto">
            {/* Hero Image */}
            {hasImage ? (
              <div className="relative h-64 md:h-80">
                <motion.img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.6 }}
                  onError={() => setImageFailed(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />

                {/* Item Name Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-3xl font-bold text-white mb-2"
                  >
                    {item.name}
                  </motion.h2>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-zinc-400"
                  >
                    {item.description ||
                      "A delicious selection prepared with care."}
                  </motion.p>
                </div>
              </div>
            ) : (
              <div className="p-6 pb-4 border-b border-white/10 bg-gradient-to-r from-zinc-900 to-zinc-900/80">
                <motion.h2
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="text-3xl font-bold text-white mb-2 pr-12"
                >
                  {item.name}
                </motion.h2>
                <motion.p
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-zinc-400"
                >
                  {item.description ||
                    "A delicious selection prepared with care."}
                </motion.p>
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Modifier Groups */}
              {item.modifier_groups?.map((group, groupIndex) => (
                <motion.div
                  key={group.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + groupIndex * 0.05 }}
                  className="border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Group Header */}
                  <button
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }))
                    }
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold">
                        {group.name}
                      </span>
                      {group.is_required && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    <motion.div
                      animate={{ rotate: expandedGroups[group.id] ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    </motion.div>
                  </button>

                  {/* Options */}
                  <AnimatePresence>
                    {expandedGroups[group.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 space-y-4"
                      >
                        {/* Separate prefix modifiers from regular options */}
                        {(() => {
                          const prefixModifiers = group.options.filter(
                            (o) => o.allow_duplicates,
                          );
                          const regularOptions = group.options.filter(
                            (o) => !o.allow_duplicates,
                          );

                          return (
                            <>
                              {/* Prefix Modifiers Section */}
                              {prefixModifiers.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-sm font-semibold text-blue-400">
                                      Prefix Modifiers
                                    </h4>
                                    <span className="text-xs text-zinc-500">
                                      (Click to add, can select multiple times)
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {prefixModifiers.map((option) => {
                                      const selection =
                                        selectedModifiers[group.id];
                                      const selectionCount = Array.isArray(
                                        selection,
                                      )
                                        ? selection.filter(
                                            (id) => id === option.id,
                                          ).length
                                        : 0;

                                      // Function to remove one instance
                                      const handleRemoveOne = (e) => {
                                        e.stopPropagation();
                                        setSelectedModifiers((prev) => {
                                          const current = prev[group.id];
                                          if (Array.isArray(current)) {
                                            const index = current.indexOf(
                                              option.id,
                                            );
                                            if (index !== -1) {
                                              const newArray = [...current];
                                              newArray.splice(index, 1);
                                              return {
                                                ...prev,
                                                [group.id]:
                                                  newArray.length === 0
                                                    ? null
                                                    : newArray,
                                              };
                                            }
                                          }
                                          return prev;
                                        });
                                      };

                                      return (
                                        <motion.button
                                          key={option.id}
                                          onClick={() =>
                                            handleModifierChange(
                                              group.id,
                                              option.id,
                                              false,
                                              1,
                                              option.allow_duplicates,
                                            )
                                          }
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/50 text-white hover:bg-blue-500/20 hover:border-blue-500 transition-all"
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                        >
                                          <Plus className="w-4 h-4 text-blue-400" />
                                          <span className="font-medium">
                                            {option.name}
                                          </span>
                                          {selectionCount > 0 && (
                                            <>
                                              <span className="text-xs px-1.5 py-0.5 bg-orange-500 text-white rounded-full font-bold">
                                                ×{selectionCount}
                                              </span>
                                              <button
                                                onClick={handleRemoveOne}
                                                className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                                              >
                                                <Minus className="w-3 h-3 text-white" />
                                              </button>
                                            </>
                                          )}
                                          {option.price > 0 && (
                                            <span className="text-xs text-blue-300">
                                              +${option.price.toFixed(2)}
                                            </span>
                                          )}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Regular Options Section */}
                              {regularOptions.length > 0 && (
                                <div className="space-y-2">
                                  {prefixModifiers.length > 0 && (
                                    <div className="border-t border-white/10 pt-3">
                                      <h4 className="text-sm font-semibold text-zinc-400 mb-2">
                                        Options
                                      </h4>
                                    </div>
                                  )}
                                  {group.max_selections > 1 && (
                                    <p className="text-xs text-zinc-500 mb-3">
                                      Select up to {group.max_selections}{" "}
                                      options
                                    </p>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {regularOptions.map((option) => {
                                      const isSelected = isOptionSelected(
                                        group.id,
                                        option.id,
                                        group.max_selections > 1,
                                      );

                                      return (
                                        <motion.button
                                          key={option.id}
                                          onClick={() =>
                                            handleModifierChange(
                                              group.id,
                                              option.id,
                                              group.max_selections > 1,
                                              group.max_selections,
                                              false,
                                            )
                                          }
                                          className={`
                                            relative flex items-center justify-between p-4 rounded-xl
                                            border transition-all duration-200
                                            ${
                                              isSelected
                                                ? "bg-orange-500/20 border-orange-500 text-white"
                                                : "bg-white/5 border-white/10 text-zinc-300 hover:border-white/30"
                                            }
                                          `}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div
                                              className={`
                                                w-5 h-5 rounded-full border-2 flex items-center justify-center
                                                ${isSelected ? "border-orange-500 bg-orange-500" : "border-zinc-500"}
                                              `}
                                            >
                                              {isSelected && (
                                                <Check className="w-3 h-3 text-white" />
                                              )}
                                            </div>
                                            <span className="font-medium">
                                              {option.name}
                                            </span>
                                          </div>

                                          {option.price > 0 && (
                                            <span
                                              className={`text-sm ${isSelected ? "text-orange-300" : "text-zinc-500"}`}
                                            >
                                              +${option.price.toFixed(2)}
                                            </span>
                                          )}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Special Instructions */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-sm text-zinc-400 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any allergies or special requests?"
                  className="
                    w-full h-24 p-4
                    bg-white/5 border border-white/10
                    rounded-xl text-white placeholder-zinc-500
                    focus:outline-none focus:border-orange-500/50
                    resize-none
                  "
                />
              </motion.div>
            </div>

            {/* Footer - Sticky */}
            <div className="sticky bottom-0 p-6 bg-zinc-900/95 backdrop-blur-xl border-t border-white/10">
              <div className="flex items-center justify-between gap-4">
                {/* Quantity Selector */}
                <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-2">
                  <motion.button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Minus className="w-5 h-5 text-white" />
                  </motion.button>
                  <span className="w-8 text-center text-white font-semibold text-lg">
                    {quantity}
                  </span>
                  <motion.button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </motion.button>
                </div>

                {/* Add to Cart Button */}
                <motion.button
                  onClick={handleAddToCart}
                  className="
                    flex-1 py-4 px-6
                    bg-gradient-to-r from-orange-500 to-orange-600
                    hover:from-orange-400 hover:to-orange-500
                    text-white font-semibold rounded-2xl
                    shadow-lg shadow-orange-500/25
                    flex items-center justify-center gap-3
                    transition-all duration-300
                  "
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-5 h-5" />
                  <span>Add to Order</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    ${calculateTotal().toFixed(2)}
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductModal;
