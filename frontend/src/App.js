import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, CartProvider, useAuth } from "./context/AppContext";

// Pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import OrdersPage from "./pages/admin/OrdersPage";
import MerchantsPage from "./pages/admin/MerchantsPage";
import MerchantDetailPage from "./pages/admin/MerchantDetailPage";
import LogsPage from "./pages/admin/LogsPage";
import ShepherdPage from "./pages/admin/ShepherdPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

// Consumer Pages — routed through template system
import {
  TemplateMenuPage,
  TemplateCartPage,
  TemplateCheckoutPage,
  TemplateOrderTrackingPage,
  TemplateOrderConfirmationPage,
} from "./templates/TemplateRouter";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Consumer Routes — template-aware */}
      <Route path="/order/:slug" element={<TemplateMenuPage />} />
      <Route path="/order/:slug/cart" element={<TemplateCartPage />} />
      <Route path="/checkout/:slug" element={<TemplateCheckoutPage />} />
      <Route path="/track/:orderId" element={<TemplateOrderTrackingPage />} />
      <Route
        path="/order-confirmation"
        element={<TemplateOrderConfirmationPage />}
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "merchant"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "merchant"]}>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/merchants"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <MerchantsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/merchants/:merchantId"
        element={
          <ProtectedRoute allowedRoles={["super_admin", "merchant"]}>
            <MerchantDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <LogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/shepherd"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <ShepherdPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["super_admin"]}>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
