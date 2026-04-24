import { create } from "zustand";
import { persist } from "zustand/middleware";

const roundMoney = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      merchantId: null,
      merchantSlug: null,

      addItem: (
        item,
        quantity,
        modifiers,
        specialInstructions,
        merchantId,
        merchantSlug,
      ) => {
        const state = get();

        // Clear cart if switching merchants
        if (state.merchantId && state.merchantId !== merchantId) {
          set({ items: [], merchantId, merchantSlug });
        }

        const cartItem = {
          id: `${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          plu: item.plu || "",
          shepherd_pos_id: item.shepherd_pos_id || item.pos_id || "",
          basePrice: item.price,
          image: item.image_url,
          quantity,
          modifiers: modifiers || [],
          specialInstructions: specialInstructions || "",
          addedAt: Date.now(),
        };

        // Calculate item total
        const modifierTotal =
          modifiers?.reduce((sum, m) => sum + (m.price || 0), 0) || 0;
        cartItem.totalPrice = roundMoney(
          (item.price + modifierTotal) * quantity,
        );

        set((state) => ({
          items: [...state.items, cartItem],
          merchantId: merchantId || state.merchantId,
          merchantSlug: merchantSlug || state.merchantSlug,
        }));

        return cartItem;
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === cartItemId) {
              const modifierTotal =
                item.modifiers?.reduce((sum, m) => sum + (m.price || 0), 0) ||
                0;
              return {
                ...item,
                quantity,
                totalPrice: roundMoney(
                  (item.basePrice + modifierTotal) * quantity,
                ),
              };
            }
            return item;
          }),
        }));
      },

      updateItemModifiers: (cartItemId, modifiers) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === cartItemId) {
              const nextModifiers = Array.isArray(modifiers) ? modifiers : [];
              const modifierTotal = nextModifiers.reduce(
                (sum, m) => sum + (m.price || 0),
                0,
              );
              return {
                ...item,
                modifiers: nextModifiers,
                totalPrice: roundMoney(
                  (item.basePrice + modifierTotal) * item.quantity,
                ),
              };
            }
            return item;
          }),
        }));
      },

      removeModifier: (cartItemId, modifierIndex) => {
        const targetItem = get().items.find((item) => item.id === cartItemId);
        if (!targetItem) return;
        const nextModifiers = (targetItem.modifiers || []).filter(
          (_, idx) => idx !== modifierIndex,
        );
        get().updateItemModifiers(cartItemId, nextModifiers);
      },

      updateSpecialInstructions: (cartItemId, specialInstructions) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id === cartItemId) {
              return {
                ...item,
                specialInstructions: specialInstructions || "",
              };
            }
            return item;
          }),
        }));
      },

      removeItem: (cartItemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== cartItemId),
        }));
      },

      clearCart: () => {
        set({ items: [], merchantId: null, merchantSlug: null });
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        const subtotal = get().items.reduce(
          (sum, item) => sum + Number(item.totalPrice || 0),
          0,
        );
        return roundMoney(subtotal);
      },

      getTax: (rate = 0.0825) => {
        const subtotal = get().getSubtotal();
        return roundMoney(subtotal * rate);
      },

      getTotal: (rate = 0.0825) => {
        const subtotal = get().getSubtotal();
        const tax = get().getTax(rate);
        return roundMoney(subtotal + tax);
      },
    }),
    {
      name: "rnoo-cart",
    },
  ),
);
