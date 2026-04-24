import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../context/AppContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import rpowerLogo from "../images/rpower-logo.png";
import {
  Store,
  MapPin,
  ShoppingBag,
  LogIn,
} from "lucide-react";

const RP_RED = "#d71920";

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

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      const res = await apiService.getPublicMerchants();
      setMerchants(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load merchants:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8]">
      <section className="bg-[linear-gradient(180deg,#11161f_0%,#17222f_100%)] px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-6xl rounded-3xl bg-[linear-gradient(140deg,#0b1120_0%,#0e1a34_65%,#132445_100%)] border border-white/10 shadow-2xl p-8 sm:p-12"
        >
          <div className="flex flex-col items-center text-center gap-5">
            <img
              src={rpowerLogo}
              alt="RPOWER"
              className="h-20 sm:h-24 w-auto object-contain"
            />
            <div className="flex items-center justify-center pt-1">
              <Button
                className="text-white hover:opacity-95"
                style={{ backgroundColor: RP_RED }}
                onClick={() => navigate("/login")}
                data-testid="home-login-btn"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
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
              <h2 className="text-2xl sm:text-3xl font-heading font-bold">
                Available Storefronts
              </h2>
              <p className="text-gray-500 mt-1">
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
                    className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-gray-200"
                    onClick={() => navigate(`/order/${merchant.slug}`)}
                    data-testid={`merchant-card-${merchant.slug}`}
                  >
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-white to-gray-100 border-b">
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
                            {merchant.city}, {merchant.state}
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
              <p className="text-gray-500">No boarded merchants are available.</p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
