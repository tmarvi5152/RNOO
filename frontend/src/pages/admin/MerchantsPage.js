import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService, api } from "../../context/AppContext";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ExternalLink,
  Store,
  MapPin,
  Phone,
  Loader2,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
  Eye,
  X,
  ShoppingCart,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";

const MerchantsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [onboardingCg, setOnboardingCg] = useState("");

  // Deboard/Delete state
  const [deboardTarget, setDeboardTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Shepherd merchants state
  const [shepherdMerchants, setShepherdMerchants] = useState([]);
  const [loadingShepherd, setLoadingShepherd] = useState(false);
  const [shepherdSearchTerm, setShepherdSearchTerm] = useState("");
  const [selectedShepherdMerchant, setSelectedShepherdMerchant] =
    useState(null);
  const [loadingShepherdDetails, setLoadingShepherdDetails] = useState(false);
  const [profilePreview, setProfilePreview] = useState(null);
  const [previewLoadingMerchantId, setPreviewLoadingMerchantId] = useState("");
  const [selectedCoreStoreId, setSelectedCoreStoreId] = useState("");

  // Detail panel state
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [merchantStats, setMerchantStats] = useState(null);
  const [loadingMerchantStats, setLoadingMerchantStats] = useState(false);

  const getMerchantLogoUrl = useCallback((merchant) => {
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
  }, []);

  const normalizeMerchantStats = useCallback((rawStats = {}, recentOrders = []) => {
    const totalOrders = Number(
      rawStats?.total_orders ?? rawStats?.totalOrders ?? rawStats?.orders_total ?? 0,
    );
    const totalRevenue = Number(
      rawStats?.total_revenue ??
        rawStats?.totalRevenue ??
        rawStats?.revenue_total ??
        0,
    );

    return {
      ...rawStats,
      total_orders: Number.isFinite(totalOrders) ? totalOrders : 0,
      total_revenue: Number.isFinite(totalRevenue) ? totalRevenue : 0,
      recent_orders: Array.isArray(recentOrders)
        ? recentOrders
        : Array.isArray(rawStats?.recent_orders)
          ? rawStats.recent_orders
          : [],
    };
  }, []);

  const [newMerchant, setNewMerchant] = useState({
    name: "",
    slug: "",
    reseller_id: "",
    address_line1: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    email: "",
    description: "",
    shepherd_config: null,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [merchantsRes, resellersRes] = await Promise.all([
        apiService.getMerchants(),
        user?.role === "super_admin"
          ? apiService.getResellers()
          : Promise.resolve({ data: [] }),
      ]);
      setMerchants(merchantsRes.data);
      setResellers(resellersRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load merchants");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMerchantStats = useCallback(async (merchantId) => {
    try {
      setLoadingMerchantStats(true);
      const [statsRes, ordersRes] = await Promise.all([
        apiService.getStats(merchantId),
        apiService.getOrders({ merchant_id: merchantId, limit: 5, skip: 0 }),
      ]);

      const statsPayload = statsRes?.data || {};
      const recentOrders = Array.isArray(ordersRes?.data?.orders)
        ? ordersRes.data.orders
        : [];

      setMerchantStats(normalizeMerchantStats(statsPayload, recentOrders));
    } catch (err) {
      console.error("Failed to load merchant stats:", err);
      // Set empty stats on error so panel still shows
      setMerchantStats(normalizeMerchantStats({}, []));
    } finally {
      setLoadingMerchantStats(false);
    }
  }, [normalizeMerchantStats]);

  const handleOpenMerchantPanel = (merchant) => {
    setSelectedMerchant(merchant);
    setMerchantStats(null);
  };

  const handleCloseMerchantPanel = () => {
    setSelectedMerchant(null);
    setMerchantStats(null);
  };

  useEffect(() => {
    if (!selectedMerchant?.id) return undefined;

    loadMerchantStats(selectedMerchant.id);
    const intervalId = setInterval(() => {
      loadMerchantStats(selectedMerchant.id);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [selectedMerchant?.id, loadMerchantStats]);

  const loadShepherdMerchants = async () => {
    if (shepherdMerchants.length > 0) return; // Already loaded

    try {
      setLoadingShepherd(true);
      const res = await apiService.getShepherdMerchants();
      setShepherdMerchants(res.data.merchants || []);
    } catch (err) {
      console.error("Failed to load Shepherd merchants:", err);
      if (err.response?.status === 503) {
        toast.info(
          "Shepherd API not configured. Set SHEPHERD_BEARER_TOKEN in backend .env to enable POS integration.",
        );
        setShepherdMerchants([]); // Set empty to allow tab viewing without error
      } else {
        toast.error("Failed to load Shepherd merchants");
      }
    } finally {
      setLoadingShepherd(false);
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const getShepherdMerchantId = (merchant) =>
    merchant?.MerchantId || merchant?.merchantId || "";

  const getShepherdDisplayName = (merchant) => {
    const fallbackLocationName =
      merchant?.LocationName ||
      merchant?.locationName ||
      merchant?.Location ||
      merchant?.location ||
      merchant?.StoreName ||
      merchant?.storeName;
    return (
      merchant?.Name ||
      merchant?.name ||
      fallbackLocationName ||
      `Merchant ${getShepherdMerchantId(merchant)}`
    );
  };

  const getShepherdFallbackProfile = (merchant) => ({
    name: getShepherdDisplayName(merchant),
    address_line1:
      merchant?.Address1 ||
      merchant?.address1 ||
      merchant?.AddressLine1 ||
      merchant?.address_line1 ||
      "",
    city: merchant?.City || merchant?.city || "",
    state: merchant?.State || merchant?.state || "",
    zip_code:
      merchant?.Zip ||
      merchant?.ZIP ||
      merchant?.zip ||
      merchant?.zip_code ||
      "",
    phone:
      merchant?.Phone ||
      merchant?.phone ||
      merchant?.PhoneNumber ||
      merchant?.phoneNumber ||
      "",
    email: merchant?.Email || merchant?.email || "",
  });

  const mergeBoardingProfile = (mergedProfile = {}, merchant) => {
    const fallback = getShepherdFallbackProfile(merchant);
    return {
      name: mergedProfile.name || fallback.name || "",
      address_line1:
        mergedProfile.address_line1 || fallback.address_line1 || "",
      city: mergedProfile.city || fallback.city || "",
      state: mergedProfile.state || fallback.state || "",
      zip_code: mergedProfile.zip_code || fallback.zip_code || "",
      phone: mergedProfile.phone || fallback.phone || "",
      email: mergedProfile.email || fallback.email || "",
    };
  };

  const formatFieldSource = (sourceMap = {}, field) => {
    const value = sourceMap[field];
    if (!value) return "fallback";
    if (value === "core") return "Core";
    if (value === "shepherd") return "Shepherd";
    return String(value);
  };

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((item) => {
          if (!item) return null;
          if (typeof item === "string") return item;

          const location = Array.isArray(item?.loc)
            ? item.loc
                .filter((part) => part !== "body")
                .map((part) => String(part))
                .join(".")
            : "";

          const messageText =
            (typeof item?.msg === "string" && item.msg) ||
            (typeof item?.message === "string" && item.message) ||
            "Validation error";

          return location ? `${location}: ${messageText}` : messageText;
        })
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join("; ");
      }
    }

    if (detail && typeof detail === "object") {
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.msg === "string") return detail.msg;
      return fallbackMessage;
    }

    return fallbackMessage;
  };

  const handleSelectShepherdMerchant = async (
    shepherdMerchant,
    preferredCoreStoreId,
  ) => {
    const merchantId = getShepherdMerchantId(shepherdMerchant);
    const cg = onboardingCg.trim();

    if (!cg) {
      toast.error(
        "Customer Group (CG) is required before selecting a merchant",
      );
      return;
    }

    // Check if already onboarded
    const alreadyOnboarded = merchants.some(
      (m) => m.shepherd_config?.merchant_id === merchantId,
    );

    if (alreadyOnboarded) {
      toast.error("This Shepherd merchant is already onboarded");
      return;
    }

    setSelectedShepherdMerchant(shepherdMerchant);
    setLoadingShepherdDetails(true);
    setProfilePreview(null);
    const requestedCoreStoreId = preferredCoreStoreId || selectedCoreStoreId;

    try {
      // Use direct Shepherd merchant details and local fallback mapping.
      const detailRes = await apiService.getShepherdMerchant(merchantId);
      const detailMerchant = detailRes?.data || shepherdMerchant;
      const profile = mergeBoardingProfile({}, detailMerchant);
      const profileName = profile.name;

      const shepherdConfig = {
        merchant_id: merchantId,
        clerk_id: "8888",
        concept_id: "RNOO",
        rpower_cg: cg,
      };
      if (requestedCoreStoreId) {
        shepherdConfig.core_store_id = requestedCoreStoreId;
      }

      // Auto-populate form from merged profile data (Core preferred)
      setNewMerchant({
        name: profileName,
        slug: generateSlug(profileName),
        reseller_id: resellers.length > 0 ? resellers[0].id : "",
        address_line1: profile.address_line1 || "",
        city: profile.city || "",
        state: profile.state || "",
        zip_code: profile.zip_code || "",
        phone: profile.phone || "",
        email: profile.email || "",
        description: `Online ordering for ${profileName}`,
        shepherd_config: shepherdConfig,
      });

      setProfilePreview({
        merchantId,
        shepherdMerchant: detailMerchant,
        coreLookup: "disabled",
        cgUsed: onboardingCg.trim() || "",
        source: {},
        merged: profile,
        coreStoreId: requestedCoreStoreId || "",
        candidates: [],
      });
      setSelectedCoreStoreId(requestedCoreStoreId || "");

      toast.success(`Loaded profile for ${profileName}`);
    } catch (err) {
      console.error("Failed to load Shepherd merchant details:", err);
      // Still populate with basic info
      const fallbackProfile = getShepherdFallbackProfile(shepherdMerchant);
      const name = fallbackProfile.name;
      setNewMerchant({
        name: name,
        slug: generateSlug(name),
        reseller_id: resellers.length > 0 ? resellers[0].id : "",
        address_line1: fallbackProfile.address_line1,
        city: fallbackProfile.city,
        state: fallbackProfile.state,
        zip_code: fallbackProfile.zip_code,
        phone: fallbackProfile.phone,
        email: fallbackProfile.email || "",
        description: `Online ordering for ${name}`,
        shepherd_config: {
          merchant_id: merchantId,
          clerk_id: "8888",
          concept_id: "RNOO",
          rpower_cg: cg,
        },
      });
      setProfilePreview({
        merchantId,
        shepherdMerchant,
        coreLookup: "failed",
        cgUsed: cg,
        source: {},
        merged: fallbackProfile,
        coreStoreId: requestedCoreStoreId || "",
        candidates: [],
      });
      toast.info("Using basic info - some details unavailable");
    } finally {
      setLoadingShepherdDetails(false);
    }
  };

  const handleFetchBoardingInformation = async (shepherdMerchant) => {
    const merchantId = getShepherdMerchantId(shepherdMerchant);
    const cg = onboardingCg.trim();
    if (!merchantId) {
      toast.error("Invalid Shepherd merchant id");
      return;
    }
    if (!cg) {
      toast.error("Customer Group (CG) is required to test profile");
      return;
    }

    try {
      setPreviewLoadingMerchantId(merchantId);
      const detailRes = await apiService.getShepherdMerchant(merchantId);
      const detailMerchant = detailRes?.data || shepherdMerchant;
      const merged = mergeBoardingProfile({}, detailMerchant);
      setProfilePreview({
        merchantId,
        shepherdMerchant: detailMerchant,
        coreLookup: "disabled",
        cgUsed: cg,
        source: {},
        merged,
        coreStoreId: selectedCoreStoreId || "",
        candidates: [],
      });
      setSelectedCoreStoreId(selectedCoreStoreId || "");
      toast.success(
        `Information fetched for ${getShepherdDisplayName(shepherdMerchant)}`,
      );
    } catch (err) {
      console.error("Failed to fetch boarding information:", err);
      toast.error("Failed to fetch information");
    } finally {
      setPreviewLoadingMerchantId("");
    }
  };

  const handleCreateMerchant = async (e) => {
    e.preventDefault();

    const cg = onboardingCg.trim();
    if (!cg) {
      toast.error("Customer Group (CG) is required");
      return;
    }

    if (
      !newMerchant.name ||
      !newMerchant.reseller_id ||
      !newMerchant.email?.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const trimmedEmail = newMerchant.email?.trim();
      const payload = {
        ...newMerchant,
        email: trimmedEmail,
        shepherd_config: {
          ...(newMerchant.shepherd_config || {}),
          rpower_cg: cg,
        },
      };

      await apiService.createMerchant(payload);
      toast.success("Merchant created successfully");
      setIsCreateOpen(false);
      resetForm();

      // Refresh in a separate guard so successful creation is not reported as a failure
      try {
        await loadData();
      } catch (refreshErr) {
        console.error("Merchant created but refresh failed:", refreshErr);
        toast.info(
          "Merchant created. Refresh the list if it does not appear immediately.",
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create merchant"));
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deboardTarget) return;
    setProcessing(true);
    try {
      await apiService.deactivateMerchant(deboardTarget.id);
      toast.success(`${deboardTarget.name} has been deactivated`);
      setDeboardTarget(null);
      loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to deactivate merchant"));
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async (merchant) => {
    setProcessing(true);
    try {
      await apiService.reactivateMerchant(merchant.id);
      toast.success(`${merchant.name} has been reactivated`);
      loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to reactivate merchant"));
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setProcessing(true);
    try {
      await apiService.deleteMerchant(deleteTarget.id);
      toast.success(`${deleteTarget.name} has been permanently deleted`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete merchant"));
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setNewMerchant({
      name: "",
      slug: "",
      reseller_id: "",
      address_line1: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      email: "",
      description: "",
      shepherd_config: null,
    });
    setSelectedShepherdMerchant(null);
    setOnboardingCg("");
    setLoadingShepherdDetails(false);
    setProfilePreview(null);
    setPreviewLoadingMerchantId("");
    setSelectedCoreStoreId("");
  };

  const handleDialogChange = (open) => {
    setIsCreateOpen(open);
    if (open) {
      loadShepherdMerchants();
    }
    if (!open) {
      resetForm();
    }
  };

  // Filter Shepherd merchants
  const filteredShepherdMerchants = shepherdMerchants.filter((m) => {
    const searchLower = shepherdSearchTerm.trim().toLowerCase();
    if (!searchLower) return true;

    const searchableFields = [
      m.Name,
      m.name,
      m.LocationName,
      m.locationName,
      m.Location,
      m.location,
      m.StoreName,
      m.storeName,
      m.MerchantId,
      m.merchantId,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return searchableFields.some((value) => value.includes(searchLower));
  });

  // Check if a Shepherd merchant is already onboarded
  const isOnboarded = (shepherdMerchant) => {
    const merchantId =
      shepherdMerchant.MerchantId || shepherdMerchant.merchantId;
    return merchants.some((m) => m.shepherd_config?.merchant_id === merchantId);
  };

  const filteredMerchants = merchants.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.city?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
              Merchants
            </h1>
            <p className="text-gray-500 mt-1">
              Manage restaurant locations and storefronts
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button
                className="bg-primary hover:bg-primary-hover"
                data-testid="add-merchant-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Merchant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">
                  Add New Merchant
                </DialogTitle>
                <DialogDescription>
                  Onboard a merchant directly from Shepherd with optional Core
                  API enrichment
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="cg-input">
                    Customer Group (CG) for Core API *
                  </Label>
                  <Input
                    id="cg-input"
                    placeholder="Example: RNOO"
                    value={onboardingCg}
                    onChange={(e) => {
                      setOnboardingCg(e.target.value);
                      setSelectedCoreStoreId("");
                      setProfilePreview(null);
                    }}
                    data-testid="merchant-cg-input"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Required. Used to enrich boarding data through Core API and
                    stored on the merchant record.
                  </p>
                </div>

                {!selectedShepherdMerchant ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search Shepherd merchants by name or ID..."
                        value={shepherdSearchTerm}
                        onChange={(e) => setShepherdSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="shepherd-search-input"
                      />
                    </div>

                    {loadingShepherd ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-2">
                        {filteredShepherdMerchants.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">
                            {shepherdMerchants.length === 0
                              ? "No Shepherd merchants available"
                              : "No merchants match your search"}
                          </p>
                        ) : (
                          filteredShepherdMerchants.map((sm) => {
                            const merchantId = getShepherdMerchantId(sm);
                            const name = getShepherdDisplayName(sm);
                            const onboarded = isOnboarded(sm);
                            const isTesting =
                              previewLoadingMerchantId === merchantId;
                            const hasFetchedInfoForMerchant =
                              profilePreview?.merchantId === merchantId;

                            return (
                              <React.Fragment key={merchantId}>
                                <div
                                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                    onboarded
                                      ? "bg-gray-50 opacity-60 cursor-not-allowed"
                                      : "hover:bg-primary/5 hover:border-primary"
                                  }`}
                                  data-testid={`shepherd-merchant-${merchantId}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                        onboarded
                                          ? "bg-gray-200"
                                          : "bg-primary/10"
                                      }`}
                                    >
                                      <Store
                                        className={`w-5 h-5 ${onboarded ? "text-gray-400" : "text-primary"}`}
                                      />
                                    </div>
                                    <div>
                                      <p className="font-medium">{name}</p>
                                      <p className="text-sm text-gray-500">
                                        ID: {merchantId}
                                      </p>
                                    </div>
                                  </div>
                                  {onboarded ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-green-100 text-green-700"
                                    >
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Onboarded
                                    </Badge>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-gray-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleFetchBoardingInformation(sm);
                                        }}
                                        disabled={isTesting}
                                      >
                                        {isTesting ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Eye className="w-4 h-4 mr-1" />
                                        )}
                                        Fetch Information
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectShepherdMerchant(sm);
                                        }}
                                        disabled={!hasFetchedInfoForMerchant}
                                      >
                                        <LinkIcon className="w-4 h-4 mr-1" />
                                        Select
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {!onboarded && !hasFetchedInfoForMerchant && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Fetch Information is required before
                                    selecting this merchant.
                                  </p>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                    )}

                    {profilePreview && (
                      <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">
                            Fetched Information: {profilePreview.merchantId}
                          </p>
                          <Badge variant="secondary">
                            Core lookup: {profilePreview.coreLookup}
                          </Badge>
                        </div>
                        {profilePreview.cgUsed && (
                          <p className="text-xs text-slate-600">
                            CG used: {profilePreview.cgUsed}
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                          <p>
                            <strong>Name:</strong>{" "}
                            {profilePreview.merged.name || "N/A"} (
                            {formatFieldSource(profilePreview.source, "name")})
                          </p>
                          <p>
                            <strong>Phone:</strong>{" "}
                            {profilePreview.merged.phone || "N/A"} (
                            {formatFieldSource(profilePreview.source, "phone")})
                          </p>
                          <p>
                            <strong>Address:</strong>{" "}
                            {profilePreview.merged.address_line1 || "N/A"} (
                            {formatFieldSource(
                              profilePreview.source,
                              "address_line1",
                            )}
                            )
                          </p>
                          <p>
                            <strong>City/State:</strong>{" "}
                            {profilePreview.merged.city || "N/A"},{" "}
                            {profilePreview.merged.state || "N/A"}
                          </p>
                          <p>
                            <strong>ZIP:</strong>{" "}
                            {profilePreview.merged.zip_code || "N/A"} (
                            {formatFieldSource(
                              profilePreview.source,
                              "zip_code",
                            )}
                            )
                          </p>
                          <p>
                            <strong>Email:</strong>{" "}
                            {profilePreview.merged.email || "N/A"}
                          </p>
                        </div>

                        {profilePreview.candidates &&
                          profilePreview.candidates.length > 1 && (
                            <div className="pt-2 border-t space-y-2">
                              <p className="text-xs font-medium text-slate-700">
                                Multiple merchants found for this CG. Choose one
                                to board:
                              </p>
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                {profilePreview.candidates.map((candidate) => {
                                  const candidateId =
                                    candidate.store_id || candidate.site_code;
                                  const isSelected =
                                    selectedCoreStoreId === candidateId;
                                  return (
                                    <div
                                      key={candidateId}
                                      className={`flex items-center justify-between border rounded-md px-2 py-2 ${
                                        isSelected
                                          ? "bg-primary/10 border-primary/30"
                                          : "bg-white"
                                      }`}
                                    >
                                      <div>
                                        <p className="text-xs font-medium text-slate-800">
                                          {candidate.name || "Unnamed"}
                                        </p>
                                        <p className="text-[11px] text-slate-600">
                                          Store: {candidate.store_id || "N/A"} |
                                          Site: {candidate.site_code || "N/A"}
                                        </p>
                                        <p className="text-[11px] text-slate-600">
                                          {candidate.city || ""}{" "}
                                          {candidate.state || ""}
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                          isSelected ? "default" : "outline"
                                        }
                                        onClick={() => {
                                          setSelectedCoreStoreId(
                                            candidateId || "",
                                          );
                                          if (profilePreview.shepherdMerchant) {
                                            handleSelectShepherdMerchant(
                                              profilePreview.shepherdMerchant,
                                              candidateId,
                                            );
                                          }
                                        }}
                                      >
                                        {isSelected ? "Selected" : "Board This"}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Shepherd Merchant Banner */}
                    <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <Store className="w-6 h-6 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-primary">
                          Onboarding from Shepherd
                        </p>
                        <p className="text-sm text-gray-600">
                          ID:{" "}
                          {selectedShepherdMerchant.MerchantId ||
                            selectedShepherdMerchant.merchantId}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedShepherdMerchant(null)}
                      >
                        Change
                      </Button>
                    </div>

                    {loadingShepherdDetails ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2">
                          Loading merchant details...
                        </span>
                      </div>
                    ) : (
                      /* Show the form with pre-filled data */
                      <MerchantForm
                        newMerchant={newMerchant}
                        setNewMerchant={setNewMerchant}
                        resellers={resellers}
                        creating={creating}
                        handleSubmit={handleCreateMerchant}
                        onCancel={() => setIsCreateOpen(false)}
                        showShepherdConfig={true}
                      />
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search merchants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-merchants-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Merchants Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Shepherd</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchants.map((merchant) => (
                      <TableRow
                        key={merchant.id}
                        data-testid={`merchant-row-${merchant.id}`}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleOpenMerchantPanel(merchant)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getMerchantLogoUrl(merchant) ? (
                              <img
                                src={getMerchantLogoUrl(merchant)}
                                alt={merchant.name}
                                className="w-10 h-10 rounded-lg object-contain border bg-white p-1"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-10 h-10 bg-primary/10 rounded-lg items-center justify-center ${getMerchantLogoUrl(merchant) ? "hidden" : "flex"}`}
                            >
                              <Store className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{merchant.name}</p>
                              <p className="text-sm text-gray-500">
                                /{merchant.slug}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <MapPin className="w-4 h-4" />
                            {merchant.city}, {merchant.state}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-4 h-4" />
                            {merchant.phone || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {merchant.shepherd_config?.merchant_id ? (
                            <Badge className="bg-green-100 text-green-700">
                              <LinkIcon className="w-3 h-3 mr-1" />
                              {merchant.shepherd_config.merchant_id}
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-gray-100 text-gray-500"
                            >
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Not Linked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {merchant.is_active ? (
                            <Badge className="bg-semantic-success/10 text-semantic-success">
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-red-100 text-red-700"
                            >
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                data-testid={`merchant-actions-${merchant.id}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  handleOpenMerchantPanel(merchant)
                                }
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(
                                    `/order/${merchant.slug}`,
                                    "_blank",
                                  )
                                }
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Store
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {merchant.is_active ? (
                                <DropdownMenuItem
                                  onClick={() => setDeboardTarget(merchant)}
                                  className="text-orange-600 focus:text-orange-600"
                                >
                                  <PowerOff className="w-4 h-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleReactivate(merchant)}
                                  className="text-green-600 focus:text-green-600"
                                >
                                  <Power className="w-4 h-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              {user?.role === "super_admin" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteTarget(merchant)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Permanently
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMerchants.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          No merchants found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deactivate Confirmation Dialog */}
        <AlertDialog
          open={!!deboardTarget}
          onOpenChange={() => setDeboardTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate Merchant?</AlertDialogTitle>
              <AlertDialogDescription>
                This will deactivate <strong>{deboardTarget?.name}</strong> and
                unlink it from Shepherd. The merchant's store will no longer be
                accessible to customers. You can reactivate it later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeactivate}
                disabled={processing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PowerOff className="w-4 h-4 mr-2" />
                )}
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">
                Permanently Delete Merchant?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{deleteTarget?.name}</strong> and all associated data
                including:
                <ul className="list-disc ml-6 mt-2">
                  <li>All menu categories and items</li>
                  <li>All order history</li>
                  <li>All configuration settings</li>
                </ul>
                <p className="mt-2 font-medium text-red-600">
                  This action cannot be undone!
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={processing}
                className="bg-red-600 hover:bg-red-700"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Merchant Detail Slide-Out Panel */}
        <AnimatePresence>
          {selectedMerchant && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseMerchantPanel}
                className="fixed inset-0 bg-black/20 z-40"
              />

              {/* Slide Panel */}
              <motion.div
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 120 }}
                className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 overflow-y-auto"
              >
                {/* Panel Header */}
                <div className="sticky top-0 flex items-center justify-between p-6 bg-white border-b">
                  <h2 className="text-xl font-bold">{selectedMerchant.name}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseMerchantPanel}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Panel Content */}
                <div className="p-6 space-y-6">
                  {/* Store Info */}
                  <div>
                    <h3 className="font-semibold text-sm text-gray-600 mb-3">
                      Store Information
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>
                          {selectedMerchant.city}, {selectedMerchant.state}{" "}
                          {selectedMerchant.zip_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{selectedMerchant.phone || "N/A"}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">Slug:</span>{" "}
                        /{selectedMerchant.slug}
                      </div>
                    </div>
                  </div>

                  {/* Status Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Status</p>
                      <Badge
                        className={
                          selectedMerchant.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {selectedMerchant.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Shepherd</p>
                      {selectedMerchant.shepherd_config?.merchant_id ? (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                          <Wifi className="w-3 h-3 mr-1" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-700 text-xs"
                        >
                          <WifiOff className="w-3 h-3 mr-1" />
                          Not Linked
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  {loadingMerchantStats ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : merchantStats ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            Total Orders
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">
                          {merchantStats.total_orders || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">
                            Total Revenue
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          ${(merchantStats.total_revenue || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Recent Orders */}
                  {merchantStats &&
                    merchantStats.recent_orders &&
                    merchantStats.recent_orders.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-sm text-gray-600 mb-3">
                          Recent Orders
                        </h3>
                        <div className="space-y-2">
                          {merchantStats.recent_orders
                            .slice(0, 3)
                            .map((order) => (
                              <div
                                key={order.id}
                                className="p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">
                                    #{order.order_number}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {order.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">
                                  ${order.total?.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {new Date(
                                    order.created_at,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.open(
                          `/order/${selectedMerchant.slug}`,
                          "_blank",
                        );
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Store
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        handleCloseMerchantPanel();
                        navigate(`/admin/merchants/${selectedMerchant.id}`);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Full Details
                    </Button>
                    {selectedMerchant.is_active ? (
                      <Button
                        variant="outline"
                        className="w-full text-orange-600 hover:text-orange-600"
                        onClick={() => {
                          handleCloseMerchantPanel();
                          setDeboardTarget(selectedMerchant);
                        }}
                      >
                        <PowerOff className="w-4 h-4 mr-2" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full text-green-600 hover:text-green-600"
                        onClick={() => {
                          handleCloseMerchantPanel();
                          handleReactivate(selectedMerchant);
                        }}
                      >
                        <Power className="w-4 h-4 mr-2" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
};

// Extracted Merchant Form Component
const MerchantForm = ({
  newMerchant,
  setNewMerchant,
  resellers,
  creating,
  handleSubmit,
  onCancel,
  showShepherdConfig,
}) => (
  <form onSubmit={handleSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="name">Restaurant Name</Label>
        <Input
          id="name"
          value={newMerchant.name}
          readOnly
          placeholder="Demo Restaurant"
          data-testid="merchant-name-input"
        />
      </div>
      <div>
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          value={newMerchant.slug}
          onChange={(e) =>
            setNewMerchant({ ...newMerchant, slug: e.target.value })
          }
          placeholder="demo-restaurant"
          data-testid="merchant-slug-input"
        />
      </div>
      <div>
        <Label htmlFor="reseller">Reseller *</Label>
        <Select
          value={newMerchant.reseller_id}
          onValueChange={(value) =>
            setNewMerchant({ ...newMerchant, reseller_id: value })
          }
        >
          <SelectTrigger data-testid="merchant-reseller-select">
            <SelectValue placeholder="Select reseller" />
          </SelectTrigger>
          <SelectContent>
            {resellers.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div>
      <Label htmlFor="email">Email *</Label>
      <Input
        id="email"
        type="email"
        value={newMerchant.email}
        onChange={(e) =>
          setNewMerchant({ ...newMerchant, email: e.target.value })
        }
        placeholder="contact@restaurant.com"
        required
        data-testid="merchant-email-input"
      />
    </div>

    <div>
      <Label htmlFor="phone">Phone</Label>
      <Input
        id="phone"
        value={newMerchant.phone}
        readOnly
        placeholder="(555) 123-4567"
        data-testid="merchant-phone-input"
      />
    </div>

    <div>
      <Label htmlFor="address">Address</Label>
      <Input
        id="address"
        value={newMerchant.address_line1}
        readOnly
        placeholder="123 Main Street"
        data-testid="merchant-address-input"
      />
    </div>

    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={newMerchant.city}
          readOnly
          placeholder="Austin"
        />
      </div>
      <div>
        <Label htmlFor="state">State</Label>
        <Input id="state" value={newMerchant.state} readOnly placeholder="TX" />
      </div>
      <div>
        <Label htmlFor="zip">ZIP</Label>
        <Input
          id="zip"
          value={newMerchant.zip_code}
          readOnly
          placeholder="78701"
        />
      </div>
    </div>

    <p className="text-xs text-gray-500">
      Fetched merchant information is read-only. You can edit URL Slug,
      Reseller, and Email.
    </p>

    {/* Show Shepherd Config if linked */}
    {showShepherdConfig && newMerchant.shepherd_config && (
      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="w-4 h-4" />
          <span className="font-medium">Shepherd Integration</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          This merchant will be linked to Shepherd ID:{" "}
          <strong>{newMerchant.shepherd_config.merchant_id}</strong>
        </p>
      </div>
    )}

    <div className="flex justify-end gap-3 pt-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        type="submit"
        className="bg-primary hover:bg-primary-hover"
        disabled={creating}
        data-testid="create-merchant-btn"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Merchant"
        )}
      </Button>
    </div>
  </form>
);

export default MerchantsPage;
