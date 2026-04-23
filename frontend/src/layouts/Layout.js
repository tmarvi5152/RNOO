import React, { useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useCart } from "../context/AppContext";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent } from "../components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Store,
  ClipboardList,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  User,
  ChevronDown,
  FileText,
  Clock,
  Server,
} from "lucide-react";

// Sidebar Component - defined outside AdminLayout
const AdminSidebar = ({
  user,
  filteredNavItems,
  location,
  handleLogout,
  mobile = false,
  onNavClick,
}) => (
  <div
    className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"} bg-rpower-sidebar text-white`}
  >
    <div className="p-6 border-b border-rpower-bg-dark">
      <Link to="/admin" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="font-heading font-bold text-white">R</span>
        </div>
        <span className="font-heading font-bold text-lg">RPOWER</span>
      </Link>
      <p className="text-xs text-rpower-text-light/60 mt-1">
        Online Ordering Admin
      </p>
    </div>

    <nav className="flex-1 p-4 space-y-1">
      {filteredNavItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isActive
                ? "bg-primary text-white"
                : "text-rpower-text-light hover:bg-rpower-bg-dark hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>

    <div className="p-4 border-t border-rpower-bg-dark">
      <div className="flex items-center gap-3 mb-4 px-4">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <span className="font-heading font-bold">
            {user?.name?.[0] || "U"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{user?.name}</p>
          <p className="text-xs text-rpower-text-light/60 capitalize">
            {user?.role?.replace("_", " ")}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start text-rpower-text-light hover:text-white hover:bg-rpower-bg-dark"
        onClick={handleLogout}
      >
        <LogOut className="w-5 h-5 mr-3" />
        Sign Out
      </Button>
    </div>
  </div>
);

// Admin Sidebar Layout
export const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleNavClick = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    {
      icon: Store,
      label: "Merchants",
      path: "/admin/merchants",
      roles: ["super_admin"],
    },
    { icon: ClipboardList, label: "Orders", path: "/admin/orders" },
    {
      icon: Server,
      label: "Shepherd",
      path: "/admin/shepherd",
      roles: ["super_admin"],
    },
    {
      icon: FileText,
      label: "Logs",
      path: "/admin/logs",
      roles: ["super_admin"],
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-30">
        <AdminSidebar
          user={user}
          filteredNavItems={filteredNavItems}
          location={location}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <AdminSidebar
            user={user}
            filteredNavItems={filteredNavItems}
            location={location}
            handleLogout={handleLogout}
            mobile
            onNavClick={handleNavClick}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="font-heading font-bold text-white text-sm">
                R
              </span>
            </div>
            <span className="font-heading font-bold">RPOWER</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

// Consumer Layout
export const ConsumerLayout = ({ children, merchant }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { itemCount, total } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const branding = merchant?.branding || {};
  const primaryColor = branding.primary_color || "#7C3AED";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        className="sticky top-0 z-50 glass border-b"
        style={{ "--brand-color": primaryColor }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to={merchant ? `/order/${merchant.slug}` : "/"}
              className="flex items-center gap-3"
            >
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={merchant?.name}
                  className="h-10 w-auto"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-heading font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {merchant?.name?.[0] || "R"}
                </div>
              )}
              <span className="font-heading font-bold text-lg hidden sm:block">
                {merchant?.name || "RPOWER Online Ordering"}
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-4">
              {merchant && (
                <Link
                  to={`/order/${merchant.slug}/cart`}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: primaryColor, color: "white" }}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="font-medium">${total.toFixed(2)}</span>
                  {itemCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-semantic-error text-white">
                      {itemCount}
                    </Badge>
                  )}
                </Link>
              )}

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      <span>{user?.name}</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/my-orders")}>
                      <ClipboardList className="w-4 h-4 mr-2" />
                      My Orders
                    </DropdownMenuItem>
                    {["super_admin", "reseller", "merchant"].includes(
                      user?.role,
                    ) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/admin")}>
                          <LayoutDashboard className="w-4 h-4 mr-2" />
                          Admin Portal
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              {merchant && (
                <Link
                  to={`/order/${merchant.slug}/cart`}
                  className="relative p-2 rounded-full"
                  style={{ backgroundColor: primaryColor, color: "white" }}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {itemCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-semantic-error text-white text-xs px-1.5">
                      {itemCount}
                    </Badge>
                  )}
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t"
            >
              <div className="px-4 py-4 space-y-2">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-2 text-sm text-gray-500">
                      Signed in as {user?.name}
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        navigate("/my-orders");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      My Orders
                    </Button>
                    {["super_admin", "reseller", "merchant"].includes(
                      user?.role,
                    ) && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          navigate("/admin");
                          setMobileMenuOpen(false);
                        }}
                      >
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Admin Portal
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-semantic-error"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      navigate("/login");
                      setMobileMenuOpen(false);
                    }}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Store Info Banner */}
      {merchant && (
        <div className="bg-white border-b py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-gray-600">
                <Clock className="w-4 h-4" />
                {merchant.is_open ? (
                  <span className="text-semantic-success font-medium">
                    Open Now
                  </span>
                ) : (
                  <span className="text-semantic-error font-medium">
                    Closed
                  </span>
                )}
              </span>
            </div>
            <span className="text-gray-500 truncate">
              {merchant.address_line1}, {merchant.city}, {merchant.state}
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-rpower-obsidian text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="font-heading font-bold text-sm">R</span>
              </div>
              <span className="text-sm text-gray-400">
                Powered by RPOWER Native Online Ordering
              </span>
            </div>
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} RPOWER. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
