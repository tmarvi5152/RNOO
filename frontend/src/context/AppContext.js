import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8765";
const API = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("rnoo_token"));
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("rnoo_token", access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (data) => {
    const res = await api.post("/auth/register", data);
    const { access_token, user: userData } = res.data;
    localStorage.setItem("rnoo_token", access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("rnoo_token");
    delete api.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Cart Context
const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("rnoo_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [merchantId, setMerchantId] = useState(() => {
    try {
      return localStorage.getItem("rnoo_cart_merchant") || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("rnoo_cart", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (merchantId) {
      localStorage.setItem("rnoo_cart_merchant", merchantId);
    } else {
      localStorage.removeItem("rnoo_cart_merchant");
    }
  }, [merchantId]);

  const addItem = (
    item,
    quantity = 1,
    modifiers = [],
    specialInstructions = "",
  ) => {
    const newItem = {
      id: `${item.id}-${Date.now()}`,
      menu_item_id: item.id,
      name: item.name,
      quantity,
      unit_price: item.price,
      modifiers,
      special_instructions: specialInstructions,
      image_url: item.image_url,
    };

    if (merchantId && merchantId !== item.merchant_id) {
      // Clear cart if switching merchants
      setItems([newItem]);
    } else {
      setItems((prev) => [...prev, newItem]);
    }
    setMerchantId(item.merchant_id);
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId);
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
      );
    }
  };

  const removeItem = (itemId) => {
    setItems((prev) => {
      const newItems = prev.filter((item) => item.id !== itemId);
      if (newItems.length === 0) setMerchantId(null);
      return newItems;
    });
  };

  const clearCart = () => {
    setItems([]);
    setMerchantId(null);
    localStorage.removeItem("rnoo_cart");
    localStorage.removeItem("rnoo_cart_merchant");
  };

  const getItemTotal = (item) => {
    const modifierTotal = item.modifiers.reduce((sum, m) => sum + m.price, 0);
    return (item.unit_price + modifierTotal) * item.quantity;
  };

  const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const configuredTaxRate = Number(process.env.REACT_APP_DEFAULT_TAX_RATE || 0);
  const tax =
    subtotal * (Number.isFinite(configuredTaxRate) ? configuredTaxRate : 0);
  const total = subtotal + tax;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        merchantId,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getItemTotal,
        subtotal,
        tax,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// API Service
export const apiService = {
  // Seed
  seed: () => api.post("/seed"),

  // Merchants
  getMerchants: () => api.get("/merchants"),
  getPublicMerchants: () => api.get("/merchants/public"),
  getMerchantBySlug: (slug) => api.get(`/merchants/slug/${slug}`),
  getMerchant: (id) => api.get(`/merchants/${id}`),
  createMerchant: (data) => api.post("/merchants", data),
  updateMerchant: (id, data) => api.put(`/merchants/${id}`, data),
  updateBranding: (id, data) => api.patch(`/merchants/${id}/branding`, data),
  updateStoreHours: (id, data) => api.patch(`/merchants/${id}/hours`, data),
  deactivateMerchant: (id) => api.post(`/merchants/${id}/deactivate`),
  reactivateMerchant: (id) => api.post(`/merchants/${id}/reactivate`),
  deleteMerchant: (id) => api.delete(`/merchants/${id}`),

  // Menu
  getCategories: (merchantId) => api.get(`/menu/categories/${merchantId}`),
  getMenuItems: (merchantId, categoryId) => {
    const params = categoryId ? { category_id: categoryId } : {};
    return api.get(`/menu/items/${merchantId}`, { params });
  },
  getMenuItem: (id) => api.get(`/menu/item/${id}`),
  createCategory: (data) => api.post("/menu/categories", data),
  createMenuItem: (data) => api.post("/menu/items", data),

  // Orders
  createOrder: (data) => api.post("/orders", data),
  validateDiscount: (data) => api.post("/discounts/validate", data),
  getOrders: (params) => api.get("/orders", { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  getOrderPublic: (id, params = {}) =>
    api.get(`/orders/public/${id}`, { params }),
  updateOrderStatus: (id, status) =>
    api.patch(`/orders/${id}/status`, null, { params: { status } }),

  // Dashboard
  getStats: (merchantId) =>
    api.get("/dashboard/stats", { params: { merchant_id: merchantId } }),
  getAdminStats: () => api.get("/dashboard/admin-stats"),

  // Resellers
  getResellers: () => api.get("/resellers"),
  getReseller: (id) => api.get(`/resellers/${id}`),
  createReseller: (data) => api.post("/resellers", data),
  updateReseller: (id, data) => api.put(`/resellers/${id}`, data),
  deleteReseller: (id) => api.delete(`/resellers/${id}`),

  // Shepherd
  getShepherdMerchants: () => api.get("/shepherd/merchants"),
  getShepherdMerchant: (merchantId) =>
    api.get(`/shepherd/merchants/${merchantId}`),

  // Users
  getUsers: () => api.get("/users"),
  getUser: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post("/users", data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  resetUserPassword: (id, data) =>
    api.post(`/users/${id}/reset-password`, data),
  resetUserPasswordByBody: (data) => api.post("/users/reset-password", data),
  migrateUserRequiredFields: () => api.post("/users/migrate-required-fields"),
  deleteUser: (id) => api.delete(`/users/${id}`),

  // Logs
  getLogs: (params) => api.get("/logs", { params }),
};

export { api };
