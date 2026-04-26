import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../context/AppContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import rpowerAdminLogo from "../images/rpower_admin_logo.png";
import {
  Store,
  MapPin,
  ShoppingBag,
  LogIn,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const RP_RED = "#cc0000";

const getMerchantLogoUrl = (merchant) => {
  const licenseInfo = merchant?.license_info || {};
  return (
    merchant?.branding?.logo_url ||
    licenseInfo.logo_url ||
    licenseInfo.MerchantSiteLogo ||
    licenseInfo.LogoUrl ||
    licenseInfo.Logo ||
    licenseInfo.SiteLogo ||
    ""
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiService.getPublicMerchants();
      setMerchants(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load merchants:", err);
      setError(
        "Could not load restaurants. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rpower-home-shell min-h-screen">
      <section className="rpower-home-hero px-4 py-12 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-6xl rounded-2xl border border-[#e4e4e4] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)] p-8 sm:p-10"
        >
          <div className="flex flex-col items-center text-center gap-5 sm:gap-6">
            <img
              src={rpowerAdminLogo}
              alt="RPOWER"
              className="h-14 sm:h-16 w-auto object-contain"
            />
            <h1 className="text-2xl sm:text-4xl font-bold text-[#1e293b] tracking-tight">
              The Industry Leader in Restaurant Point of Sale Software
            </h1>
            <p className="max-w-3xl text-sm sm:text-base text-[#475569]">
              Power your online ordering experience with the reliability,
              performance, and support expected from RPOWER POS.
            </p>
            <div className="flex items-center justify-center pt-1">
              <Button
                className="text-white hover:opacity-95 px-7"
                style={{ backgroundColor: RP_RED }}
                onClick={() => navigate("/login")}
                data-testid="home-login-btn"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Merchants Grid */}
      <section className="py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-[#1e293b]">
                Available Storefronts
              </h2>
              <p className="text-[#64748b] mt-1">
                Browse boarded merchants and start ordering
              </p>
            </div>
            {merchants.length > 0 && (
              <Badge variant="outline" className="text-sm">
                {merchants.length} Store{merchants.length !== 1 ? "s" : ""}
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
          ) : error ? (
            <Card className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
              <h3 className="text-xl font-heading font-semibold mb-2">
                Unable to Load Restaurants
              </h3>
              <p className="text-gray-500 mb-6">{error}</p>
              <Button onClick={loadMerchants} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </Card>
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
                    className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-[#e2e8f0]"
                    onClick={() => navigate(`/order/${merchant.slug}`)}
                    data-testid={`merchant-card-${merchant.slug}`}
                  >
                    <div className="relative h-48 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] border-b border-[#e2e8f0]">
                      {getMerchantLogoUrl(merchant) ? (
                        <img
                          src={getMerchantLogoUrl(merchant)}
                          alt={merchant.name}
                          className="w-full h-full object-contain p-5 group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-full h-full items-center justify-center ${getMerchantLogoUrl(merchant) ? "hidden" : "flex"}`}
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
                          style={{
                            backgroundColor:
                              merchant.branding?.primary_color || RP_RED,
                          }}
                        >
                          <Store className="w-8 h-8" />
                        </div>
                      </div>

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
                            {[merchant.city, merchant.state]
                              .filter(Boolean)
                              .join(", ") || "Location not listed"}
                          </div>
                        </div>
                      </div>
                      {merchant.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                          {merchant.description}
                        </p>
                      )}
                      <Button
                        className="w-full mt-4 text-white hover:opacity-95"
                        style={{
                          backgroundColor:
                            merchant.branding?.primary_color || RP_RED,
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
              <p className="text-gray-500">
                No boarded merchants are available.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
