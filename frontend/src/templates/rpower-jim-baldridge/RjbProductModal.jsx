import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Minus, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "../../stores/cartStore";

const RjbProductModal = ({ item, onClose, merchantId, merchantSlug }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [imageFailed, setImageFailed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (item?.modifier_groups) {
      const defaults = {};
      const expanded = {};
      item.modifier_groups.forEach((group) => {
        expanded[group.id] = true;
        const defaultOption = group.options.find((o) => o.is_default);
        if (group.is_required && defaultOption) {
          if (group.max_selections === 1) defaults[group.id] = defaultOption.id;
          else defaults[group.id] = [defaultOption.id];
        } else {
          defaults[group.id] = group.max_selections === 1 ? null : [];
        }
      });
      setSelectedModifiers(defaults);
      setExpandedGroups(expanded);
      setAttempted(false);
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
        }
        if (current.length < maxSelections) {
          return { ...prev, [groupId]: [...current, optionId] };
        }
        return prev;
      }

      const current = prev[groupId];
      if (allowDuplicates) {
        const currentArray = Array.isArray(current)
          ? current
          : current
            ? [current]
            : [];
        return { ...prev, [groupId]: [...currentArray, optionId] };
      }

      return { ...prev, [groupId]: optionId };
    });
  };

  const calculateTotal = () => {
    if (!item) return 0;
    let total = item.price;

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

    for (let i = 0; i < orderedModifiers.length; i += 1) {
      const modifier = orderedModifiers[i];
      const prevModifier = i > 0 ? orderedModifiers[i - 1] : null;
      const isFree = prevModifier && prevModifier.plu === "NO";
      if (!isFree) total += modifier.price;
    }

    return total * quantity;
  };

  const isGroupSatisfied = (group) => {
    if (!group?.is_required) return true;
    const selection = selectedModifiers[group.id];
    const min = group.min_selections || 1;
    if (group.max_selections === 1) return Boolean(selection);
    return Array.isArray(selection) && selection.length >= min;
  };

  const handleAddToCart = () => {
    setAttempted(true);
    for (const group of item.modifier_groups || []) {
      if (group.is_required && !isGroupSatisfied(group)) {
        toast.error(`Please select ${group.name}`);
        return;
      }
    }

    const modifiers = [];
    item.modifier_groups?.forEach((group) => {
      const selection = selectedModifiers[group.id];

      if (Array.isArray(selection)) {
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

    const finalModifiers = [];
    let i = 0;
    while (i < modifiers.length) {
      const current = modifiers[i];
      const next = i + 1 < modifiers.length ? modifiers[i + 1] : null;
      const isPrefixModifier =
        current.option_name && current.option_name.trim().endsWith("~");
      const isNOModifier = current.plu === "NO";

      if (isPrefixModifier && !isNOModifier && next) {
        const prefixName = current.option_name.replace(/~\s*$/, "").trim();
        finalModifiers.push({
          group_id: current.group_id,
          group_name: current.group_name,
          option_id: current.option_id,
          option_name: `${prefixName} ${next.option_name}`,
          price: current.price + next.price,
          plu: "",
          shepherd_pos_id: current.shepherd_pos_id,
          combined: true,
          original_modifiers: [current, next],
        });
        i += 2;
      } else if (isNOModifier && next) {
        finalModifiers.push(current);
        finalModifiers.push({
          ...next,
          original_price: next.price,
          price: 0,
          price_override_reason: "NO modifier",
        });
        i += 2;
      } else {
        finalModifiers.push(current);
        i += 1;
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
        <Sparkles className="w-4 h-4 text-[#e8ba53]" />
        <span>Added {item.name} to your order</span>
      </div>,
    );

    onClose();
  };

  const isOptionSelected = (groupId, optionId, isMultiple) => {
    const selection = selectedModifiers[groupId];
    if (isMultiple) return (selection || []).includes(optionId);
    if (Array.isArray(selection)) return selection.includes(optionId);
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
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2"
      >
        <motion.div
          layoutId={`product-${item.id}`}
          initial={{ opacity: 0, scale: 0.93, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 24 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="rjb-modal-shell relative w-full max-w-xl max-h-[84vh] rounded-[20px] overflow-hidden border border-[#e8ba5366] bg-[linear-gradient(165deg,#111923_0%,#0e141d_60%,#0b1017_100%)] shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        >
          <button
            onClick={onClose}
            className="rjb-modal-close absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 border border-[#e8ba5344] flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="max-h-[84vh] overflow-y-auto">
            {hasImage ? (
              <div className="relative h-44 md:h-56">
                <motion.img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  initial={{ scale: 1.07 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.6 }}
                  onError={() => setImageFailed(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1219] via-[#0d1219]/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <motion.h2
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="rjb-modal-title text-2xl md:text-3xl font-light tracking-[0.02em] text-white"
                    style={{
                      fontFamily:
                        "Palatino Linotype, Book Antiqua, Palatino, Georgia, serif",
                    }}
                  >
                    {item.name}
                  </motion.h2>
                  <motion.p
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.18 }}
                    className="rjb-modal-desc text-white/70 mt-2"
                  >
                    {item.description ||
                      "A crafted selection prepared with care."}
                  </motion.p>
                </div>
              </div>
            ) : (
              <div className="p-4 pb-3 border-b border-[#e8ba532a]">
                <h2
                  className="rjb-modal-title text-2xl md:text-3xl font-light tracking-[0.02em] text-white pr-12"
                  style={{
                    fontFamily:
                      "Palatino Linotype, Book Antiqua, Palatino, Georgia, serif",
                  }}
                >
                  {item.name}
                </h2>
                <p className="rjb-modal-desc text-white/70 mt-2">
                  {item.description ||
                    "A crafted selection prepared with care."}
                </p>
              </div>
            )}

            <div className="rjb-modal-content p-4 space-y-4">
              {item.modifier_groups?.map((group, groupIndex) => (
                <motion.div
                  key={group.id}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.08 + groupIndex * 0.05 }}
                  className={`rjb-modifier-group border rounded-2xl overflow-hidden ${
                    attempted && !isGroupSatisfied(group)
                      ? "border-[#cf2030] bg-[#cf203012]"
                      : "border-[#e8ba532f]"
                  }`}
                >
                  <button
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }))
                    }
                    className="rjb-modifier-header w-full flex items-center justify-between p-3 bg-[#f5f7fb08] hover:bg-[#f5f7fb12] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold">
                        {group.name}
                      </span>
                      {group.is_required && (
                        <span className="px-2 py-0.5 bg-[#e8ba5320] text-[#e8ba53] text-xs rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    <motion.div
                      animate={{ rotate: expandedGroups[group.id] ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-white/55" />
                    </motion.div>
                  </button>
                  {attempted && !isGroupSatisfied(group) && (
                    <div className="px-3 py-2 text-xs font-medium text-[#ff9aa3] bg-[#cf20301a] border-t border-[#cf203044]">
                      Choose at least {group.min_selections || 1} option
                      {(group.min_selections || 1) > 1 ? "s" : ""} to continue.
                    </div>
                  )}

                  <AnimatePresence>
                    {expandedGroups[group.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-3 space-y-3"
                      >
                        {(() => {
                          const prefixModifiers = group.options.filter(
                            (o) => o.allow_duplicates,
                          );
                          const regularOptions = group.options.filter(
                            (o) => !o.allow_duplicates,
                          );

                          return (
                            <>
                              {prefixModifiers.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-sm font-semibold text-[#e8ba53]">
                                      Prefix Modifiers
                                    </h4>
                                    <span className="text-xs text-white/50">
                                      (Can select multiple times)
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
                                          className="rjb-prefix-option flex items-center gap-2 px-3 py-2 rounded-lg bg-[#e8ba5312] border border-[#e8ba5358] text-white hover:bg-[#e8ba5320] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8ba53]/60"
                                          whileHover={{ scale: 1.04 }}
                                          whileTap={{ scale: 0.95 }}
                                        >
                                          <Plus className="w-4 h-4 text-[#e8ba53]" />
                                          <span className="font-medium">
                                            {option.name}
                                          </span>
                                          {selectionCount > 0 && (
                                            <>
                                              <span className="text-xs px-1.5 py-0.5 bg-[#cf2030] text-white rounded-full font-bold">
                                                x{selectionCount}
                                              </span>
                                              <button
                                                onClick={handleRemoveOne}
                                                className="w-10 h-10 rounded-full bg-[#cf2030] hover:bg-[#b11928] flex items-center justify-center transition-colors"
                                                aria-label={`Remove one ${option.name}`}
                                              >
                                                <Minus className="w-3 h-3 text-white" />
                                              </button>
                                            </>
                                          )}
                                          {option.price > 0 && (
                                            <span className="text-xs text-[#e8ba53]">
                                              +${option.price.toFixed(2)}
                                            </span>
                                          )}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {regularOptions.length > 0 && (
                                <div className="space-y-3">
                                  {prefixModifiers.length > 0 && (
                                    <div className="border-t border-[#e8ba532a] pt-3">
                                      <h4 className="text-sm font-semibold text-white/70 mb-2">
                                        Options
                                      </h4>
                                    </div>
                                  )}
                                  {group.max_selections > 1 && (
                                    <p className="text-xs text-white/50 mb-3">
                                      Select up to {group.max_selections}{" "}
                                      options
                                    </p>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                          className={`rjb-option-button relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8ba53]/60 ${
                                            isSelected
                                              ? "bg-[#e8ba5322] border-[#e8ba53] text-white"
                                              : "bg-[#f5f7fb08] border-[#e8ba532f] text-white/80 hover:border-[#e8ba5370]"
                                          }`}
                                          whileHover={{ scale: 1.015 }}
                                          whileTap={{ scale: 0.98 }}
                                        >
                                          <div className="flex items-center gap-3">
                                            <div
                                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-[#e8ba53] bg-[#e8ba53]" : "border-white/45"}`}
                                            >
                                              {isSelected && (
                                                <Check className="w-3 h-3 text-[#111]" />
                                              )}
                                            </div>
                                            <span className="font-medium">
                                              {option.name}
                                            </span>
                                          </div>

                                          {option.price > 0 && (
                                            <span
                                              className={`text-sm ${isSelected ? "text-[#e8ba53]" : "text-white/45"}`}
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

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.28 }}
              >
                <label className="rjb-modal-label block text-xs text-white/65 mb-1.5">
                  Special Instructions
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any allergies or special requests?"
                  className="rjb-modal-notes w-full h-20 p-3 bg-[#f5f7fb08] border border-[#e8ba532f] rounded-xl text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#e8ba53] resize-none"
                />
              </motion.div>
            </div>

            <div className="rjb-modal-footer sticky bottom-0 p-3 bg-[#0f151e]/96 backdrop-blur-xl border-t border-[#e8ba532a]">
              <div className="flex items-center justify-between gap-3">
                <div className="rjb-modal-qty-wrap flex items-center gap-1.5 bg-[#f5f7fb08] rounded-xl p-1.5 border border-[#e8ba532a]">
                  <motion.button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="rjb-modal-qty-btn w-11 h-11 rounded-md bg-[#1d2633] hover:bg-[#263245] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8ba53]/60 disabled:opacity-40 disabled:cursor-not-allowed"
                    whileTap={{ scale: 0.9 }}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 text-white" />
                  </motion.button>
                  <span className="w-9 text-center text-white font-semibold text-base">
                    {quantity}
                  </span>
                  <motion.button
                    onClick={() => setQuantity(quantity + 1)}
                    className="rjb-modal-qty-btn w-11 h-11 rounded-md bg-[#1d2633] hover:bg-[#263245] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8ba53]/60"
                    whileTap={{ scale: 0.9 }}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </motion.button>
                </div>

                <motion.button
                  onClick={handleAddToCart}
                  className="rjb-modal-submit flex-1 py-3 px-4 bg-gradient-to-r from-[#cf2030] to-[#b11928] hover:from-[#d62939] hover:to-[#bf1f2e] text-white text-sm font-semibold rounded-lg shadow-lg shadow-[#cf203035] flex items-center justify-center gap-2 transition-all duration-300"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Ticket</span>
                  <span className="px-2.5 py-0.5 bg-black/20 rounded-full text-xs">
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

export default RjbProductModal;
