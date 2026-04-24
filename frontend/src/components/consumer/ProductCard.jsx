import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Clock, Flame, Star, Plus } from 'lucide-react';

const ProductCard = ({ item, onSelect, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const cardRef = useRef(null);
  
  // Mouse position for 3D effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotateX = useSpring(useTransform(y, [-100, 100], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-100, 100], [-8, 8]), { stiffness: 300, damping: 30 });
  
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const hasImage = Boolean(item.image_url && !item.image_url.includes('placeholder') && !imageFailed);

  if (!hasImage) {
    return (
      <motion.button
        type="button"
        layoutId={`product-${item.id}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        onClick={() => onSelect(item)}
        className="
          w-full text-left
          relative group
          bg-gradient-to-r from-zinc-900/80 via-zinc-900/70 to-zinc-900/60
          border border-white/10 hover:border-orange-500/40
          rounded-xl p-2.5 sm:p-3
          transition-all duration-300
        "
        whileHover={{
          y: -2,
          boxShadow: '0 14px 30px -20px rgba(249, 115, 22, 0.45)'
        }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <h3 className="text-sm sm:text-base font-semibold text-white line-clamp-1 group-hover:text-orange-300 transition-colors">
                {item.name}
              </h3>
              {item.is_popular && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-orange-500/20 border border-orange-500/35 text-orange-300">
                  Popular
                </span>
              )}
              {item.is_spicy && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-red-500/20 border border-red-500/35 text-red-300">
                  <Flame className="w-3 h-3" />
                  Spicy
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 line-clamp-1 pr-1">
              {item.description || 'Tap to customize this item.'}
            </p>

            {item.prep_time && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500">
                <Clock className="w-3 h-3" />
                <span>{item.prep_time} min</span>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <span className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              ${item.price.toFixed(2)}
            </span>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/90 text-white shadow-md shadow-orange-500/20 group-hover:bg-orange-400 transition-colors">
              <Plus className="w-4 h-4" />
            </span>
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      layoutId={`product-${item.id}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect(item)}
      style={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        transformStyle: 'preserve-3d',
      }}
      className="
        relative group cursor-pointer
        bg-gradient-to-b from-zinc-800/50 to-zinc-900/50
        backdrop-blur-sm
        border border-white/5 hover:border-orange-500/30
        rounded-3xl overflow-hidden
        transition-all duration-500
      "
      whileHover={{ 
        scale: 1.02,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(249, 115, 22, 0.1)'
      }}
    >
      {/* Glow Effect */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      />
      
      {/* Image Section */}
      <div className="relative h-32 overflow-hidden">
        <>
          <motion.img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.6 }}
            onError={() => setImageFailed(true)}
          />
          {/* Ken Burns subtle drift */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent"
          />
        </>
        
        {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {item.is_popular && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="px-2 py-0.5 bg-orange-500/90 backdrop-blur-sm rounded-full text-[10px] font-medium text-white flex items-center gap-1"
            >
              <Star className="w-3 h-3" fill="currentColor" />
              Popular
            </motion.span>
          )}
          {item.is_spicy && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="px-2 py-0.5 bg-red-500/90 backdrop-blur-sm rounded-full text-[10px] font-medium text-white flex items-center gap-1"
            >
              <Flame className="w-3 h-3" />
              Spicy
            </motion.span>
          )}
        </div>

        {/* Quick Add Button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: isHovered ? 1 : 0, 
            scale: isHovered ? 1 : 0.8 
          }}
          className="
            absolute bottom-2 right-2
            w-8 h-8 rounded-xl
            bg-orange-500 hover:bg-orange-400
            shadow-lg shadow-orange-500/30
            flex items-center justify-center
            transition-colors
          "
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-4 h-4 text-white" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-3.5">
        {/* Title */}
        <h3 className="text-sm font-semibold text-white mb-1.5 line-clamp-1 group-hover:text-orange-300 transition-colors">
          {item.name}
        </h3>
        
        {/* Description */}
        <motion.p 
          className="text-xs text-zinc-400 line-clamp-2 mb-2.5"
          animate={{ 
            height: isHovered ? 'auto' : '2.5rem',
            opacity: isHovered ? 1 : 0.7
          }}
        >
          {item.description || 'A delicious selection prepared with care.'}
        </motion.p>

        {/* Price & CTA */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              ${item.price.toFixed(2)}
            </span>
          </div>

          <motion.span 
            className="text-[10px] text-orange-400 font-medium uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Customize →
          </motion.span>
        </div>

        {/* Prep Time (if available) */}
        {item.prep_time && (
          <div className="flex items-center gap-1 mt-2 text-[11px] text-zinc-500">
            <Clock className="w-2.5 h-2.5" />
            <span>{item.prep_time} min</span>
          </div>
        )}
      </div>

      {/* Hover Shine Effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, transparent 50%)',
          transform: isHovered ? 'translateX(100%)' : 'translateX(-100%)',
          transition: 'transform 0.6s ease',
        }}
      />
    </motion.div>
  );
};

export default ProductCard;
