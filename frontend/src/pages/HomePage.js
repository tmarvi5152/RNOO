import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService, useAuth } from "../context/AppContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { toast } from "sonner";
import {
  Store,
  ArrowRight,
  MapPin,
  Loader2,
  ShoppingBag,
  LayoutDashboard,
} from "lucide-react";

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const res = await apiService.getPublicMerchants();
      setMerchants(res.data);
    } catch (err) {
      console.error("Failed to load merchants:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await apiService.seed();
      toast.success("Demo data created successfully!");
      console.log("Seed credentials:", res.data.credentials);
      loadMerchants();
    } catch (err) {
      if (err.response?.data?.message?.includes("already seeded")) {
        toast.info("Database already has demo data");
      } else {
        toast.error("Failed to seed database");
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-rpower-obsidian">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="font-heading font-bold text-xl text-white">
                  R
                </span>
              </div>
              <div>
                <h1 className="font-heading font-bold text-white text-lg">
                  RPOWER
                </h1>
                <p className="text-xs text-gray-400">Online Ordering</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {["super_admin", "merchant"].includes(user?.role) && (
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                      onClick={() => navigate("/admin")}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  )}
                  <span className="text-sm text-gray-400">{user?.name}</span>
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-rpower-obsidian py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-white mb-6"
            >
              Native Online Ordering
              <br />
              <span className="text-primary">Powered by RPOWER</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8"
            >
              Multi-tenant SaaS platform for restaurant online ordering.
              Integrated with Shepherd middleware for seamless POS connectivity.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              {merchants.length === 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-rpower-obsidian"
                  onClick={handleSeedDatabase}
                  disabled={seeding}
                  data-testid="seed-database-btn"
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating Demo Data...
                    </>
                  ) : (
                    "Initialize Demo Data"
                  )}
                </Button>
              )}
              <Button
                size="lg"
                className="bg-primary hover:bg-primary-hover"
                onClick={() => navigate("/login")}
                data-testid="get-started-btn"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Merchants Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-heading font-bold">
                Order from Local Restaurants
              </h2>
              <p className="text-gray-500 mt-1">
                Browse menus and order online
              </p>
            </div>
            {merchants.length > 0 && (
              <Badge variant="outline" className="text-sm">
                {merchants.length} Restaurant{merchants.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : merchants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {merchants.map((merchant, index) => (
                <motion.div
                  key={merchant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                    onClick={() => navigate(`/order/${merchant.slug}`)}
                    data-testid={`merchant-card-${merchant.slug}`}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={
                          merchant.branding?.banner_url ||
                          "https://images.pexels.com/photos/2271107/pexels-photo-2271107.jpeg"
                        }
                        alt={merchant.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 right-3">
                        {merchant.is_open ? (
                          <Badge className="bg-semantic-success text-white">
                            Open
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-heading font-semibold text-lg">
                            {merchant.name}
                          </h3>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin className="w-4 h-4" />
                            {merchant.city}, {merchant.state}
                          </div>
                        </div>
                        {merchant.branding?.logo_url ? (
                          <img
                            src={merchant.branding.logo_url}
                            alt={merchant.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-10 rounded-full items-center justify-center text-white ${merchant.branding?.logo_url ? "hidden" : "flex"}`}
                          style={{
                            backgroundColor:
                              merchant.branding?.primary_color || "#7C3AED",
                          }}
                        >
                          <Store className="w-5 h-5" />
                        </div>
                      </div>
                      {merchant.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                          {merchant.description}
                        </p>
                      )}
                      <Button
                        className="w-full mt-4"
                        style={{
                          backgroundColor:
                            merchant.branding?.primary_color || "#7C3AED",
                        }}
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Order Now
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Store className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-heading font-semibold mb-2">
                No Restaurants Yet
              </h3>
              <p className="text-gray-500 mb-6">
                Click &quot;Initialize Demo Data&quot; above to create a sample
                restaurant
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-center mb-12">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Multi-Tenant Architecture",
                description:
                  "Each merchant gets their own branded storefront with custom colors and logos.",
              },
              {
                title: "POS Integration",
                description:
                  "Orders are formatted in POSCNX XML and sent to Shepherd for POS injection.",
              },
              {
                title: "Role-Based Access",
                description:
                  "Super Admin and Merchant roles with appropriate permissions.",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <div className="w-6 h-6 bg-primary rounded-md" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-500">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-rpower-obsidian text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="font-heading font-bold text-sm">R</span>
              </div>
              <span className="text-sm text-gray-400">
                RPOWER Native Online Ordering
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

export default HomePage;
