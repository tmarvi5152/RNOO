import React from "react";
import { motion } from "framer-motion";

const CategoryNav = ({ categories, selectedCategory, onSelectCategory }) => {
  // Get emoji for category based on name
  const getCategoryEmoji = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("burger") || lower.includes("sandwich")) return "🍔";
    if (lower.includes("pizza")) return "🍕";
    if (lower.includes("salad") || lower.includes("fresh")) return "🥗";
    if (lower.includes("drink") || lower.includes("beverage")) return "🥤";
    if (
      lower.includes("beer") ||
      lower.includes("wine") ||
      lower.includes("alcohol")
    )
      return "🍺";
    if (lower.includes("dessert") || lower.includes("sweet")) return "🍰";
    if (
      lower.includes("side") ||
      lower.includes("fries") ||
      lower.includes("appetizer")
    )
      return "🍟";
    if (lower.includes("breakfast")) return "🍳";
    if (lower.includes("soup")) return "🍜";
    if (lower.includes("chicken") || lower.includes("wing")) return "🍗";
    if (lower.includes("fish") || lower.includes("seafood")) return "🐟";
    if (lower.includes("steak") || lower.includes("meat")) return "🥩";
    if (lower.includes("taco") || lower.includes("mexican")) return "🌮";
    if (lower.includes("pasta") || lower.includes("italian")) return "🍝";
    if (lower.includes("coffee")) return "☕";
    if (lower.includes("happy") || lower.includes("special")) return "⭐";
    return "✨";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative px-1"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:p-3">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {categories.map((category, index) => {
            const isSelected = selectedCategory === category.id;
            const emoji = getCategoryEmoji(category.name);

            return (
              <motion.button
                key={category.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => onSelectCategory(category.id)}
                className={`
                  relative flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl
                  border transition-all duration-300 min-h-[46px]
                  ${
                    isSelected
                      ? "bg-orange-500/20 border-orange-500/50 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.25)]"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }
                `}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Glow Effect for Selected */}
                {isSelected && (
                  <motion.div
                    layoutId="category-glow"
                    className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <span className="relative text-xl">{emoji}</span>
                <span className="relative font-medium whitespace-nowrap">
                  {category.name}
                </span>

                {/* Item Count Badge */}
                {category.item_count > 0 && (
                  <span
                    className={`
                    relative ml-1 w-6 h-6 rounded-full text-xs font-medium
                    flex items-center justify-center
                    ${isSelected ? "bg-orange-500 text-white" : "bg-white/10 text-zinc-400"}
                  `}
                  >
                    {category.item_count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default CategoryNav;
