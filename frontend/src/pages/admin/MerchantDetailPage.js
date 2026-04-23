import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "../../layouts/Layout";
import { api } from "../../context/AppContext";
import { TEMPLATE_LIST, DEFAULT_TEMPLATE } from "../../templates/registry";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "../../components/ui/avatar";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { toast } from "sonner";
import {
  ArrowLeft,
  Store,
  MapPin,
  Phone,
  Clock,
  Menu,
  Percent,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Server,
  Monitor,
  Building,
  Settings,
  Database,
  Shield,
  Edit,
  Save,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";

// Full Menu Viewer Component
const FullMenuViewer = ({ menuData, taxRates, schedules }) => {
  const [expandedMenus, setExpandedMenus] = React.useState({});
  const [expandedSections, setExpandedSections] = React.useState({});

  const menus = menuData?.Menus || [];

  const normalizeMoney = (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 0;
    // Shepherd price fields are cents in menu payloads.
    return numeric / 100;
  };

  const getItemPriceRows = (item) => {
    const prices = Array.isArray(item?.Prices) ? item.Prices : [];
    if (prices.length > 0) {
      return prices.map((price, idx) => ({
        id: `price-${idx}`,
        amount: normalizeMoney(price?.Price || 0),
        name: price?.Name || "Default",
        scheduleId: price?.ScheduleId,
      }));
    }

    if (item?.Price !== undefined && item?.Price !== null) {
      return [
        {
          id: "base-price",
          amount: normalizeMoney(item.Price),
          name: "Default",
          scheduleId: item?.ScheduleId,
        },
      ];
    }

    return [];
  };

  const getModifierGroups = (item) => {
    const modPrompts = Array.isArray(item?.ModPrompts) ? item.ModPrompts : [];
    if (modPrompts.length > 0) {
      return modPrompts.map((group, idx) => ({
        id: group?.PosId || group?.Name || `group-${idx}`,
        name: group?.Name || group?.PosId || `Modifier Group ${idx + 1}`,
        minMods: group?.MinMods ?? 0,
        maxMods: group?.MaxMods ?? 0,
        options: Array.isArray(group?.Modifiers)
          ? group.Modifiers.map((mod, modIdx) => ({
              id: mod?.Mid || mod?.PosId || `mod-${idx}-${modIdx}`,
              name: mod?.Name || mod?.PosId || "Unnamed Modifier",
              price: normalizeMoney(mod?.Price || 0),
            }))
          : [],
      }));
    }

    const directModifiers = Array.isArray(item?.Modifiers)
      ? item.Modifiers
      : [];
    if (directModifiers.length > 0) {
      return [
        {
          id: "direct-modifiers",
          name: "Modifiers",
          minMods: 0,
          maxMods: 0,
          options: directModifiers.map((mod, idx) => ({
            id: mod?.Mid || mod?.PosId || `direct-mod-${idx}`,
            name: mod?.Name || mod?.PosId || "Unnamed Modifier",
            price: normalizeMoney(mod?.Price || 0),
          })),
        },
      ];
    }

    return [];
  };

  const menuAnalytics = React.useMemo(() => {
    const summary = {
      totalMenus: menus.length,
      rnooMenus: 0,
      totalSections: 0,
      totalItems: 0,
      totalModifiers: 0,
      pricedItems: 0,
      unpricedItems: 0,
      hiddenItems: 0,
      featuredItems: 0,
      alcoholItems: 0,
      uniqueScheduleIds: new Set(),
      uniqueTaxRateIds: new Set(),
    };

    menus.forEach((menu) => {
      const menuId = menu?.MenuId || menu?.PosId || "";
      if (String(menuId).toUpperCase().includes("RNOO")) {
        summary.rnooMenus += 1;
      }

      if (menu?.ScheduleId) summary.uniqueScheduleIds.add(menu.ScheduleId);
      if (menu?.TaxRateId) summary.uniqueTaxRateIds.add(menu.TaxRateId);

      const sections = Array.isArray(menu?.Sections) ? menu.Sections : [];
      summary.totalSections += sections.length;

      sections.forEach((section) => {
        const items = Array.isArray(section?.Items) ? section.Items : [];
        summary.totalItems += items.length;

        items.forEach((item) => {
          const prices = getItemPriceRows(item);
          const modifierGroups = getModifierGroups(item);
          const modifierCount = modifierGroups.reduce(
            (sum, group) => sum + (group.options?.length || 0),
            0,
          );

          summary.totalModifiers += modifierCount;
          if (prices.length > 0) summary.pricedItems += 1;
          else summary.unpricedItems += 1;
          if (item?.IsHidden) summary.hiddenItems += 1;
          if (item?.IsFeatured) summary.featuredItems += 1;
          if (item?.IsAlcohol) summary.alcoholItems += 1;
          if (item?.ScheduleId) summary.uniqueScheduleIds.add(item.ScheduleId);
          if (item?.TaxRateId) summary.uniqueTaxRateIds.add(item.TaxRateId);
        });
      });
    });

    return {
      ...summary,
      uniqueScheduleCount: summary.uniqueScheduleIds.size,
      uniqueTaxRateCount: summary.uniqueTaxRateIds.size,
    };
  }, [menus]);

  const toggleMenu = (menuId) => {
    setExpandedMenus((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const getTaxRateInfo = (taxRateId) => {
    if (!taxRateId) return null;
    const taxRate = taxRates?.TaxRates?.find(
      (t) => t.TaxRateId === taxRateId || t.Id === taxRateId,
    );
    if (!taxRate) return null;
    return {
      name: taxRate.Name || taxRateId,
      rate: taxRate.Rate ? `${(taxRate.Rate * 100).toFixed(2)}%` : "N/A",
    };
  };

  const getScheduleInfo = (scheduleId) => {
    if (!scheduleId) return null;
    const schedulesArray = Array.isArray(schedules)
      ? schedules
      : schedules?.schedules || [];
    const schedule = schedulesArray.find((s) => s.posId === scheduleId);
    if (!schedule) return null;

    const formatDays = (daysStr) => {
      if (!daysStr) return "N/A";
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const active = days.filter((_, i) => daysStr[i] === "Y");
      if (active.length === 7) return "Every Day";
      if (active.length === 0) return "None";
      return active.join(", ");
    };

    return {
      name: schedule.name,
      days: formatDays(schedule.daysOfWeek),
      start: schedule.start || "All Day",
      end: schedule.end || "All Day",
    };
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(menuData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `menu-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Menu data exported successfully");
  };

  if (!menuData || !menus.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Menu Data Available</h3>
          <p className="text-gray-500">
            Menu data has not been synced from Shepherd yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Menu Analysis</CardTitle>
          <CardDescription>
            Coverage and structure analysis across all available export menus.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Menus
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.totalMenus}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                RNOO Menus
              </p>
              <p className="text-sm font-semibold">{menuAnalytics.rnooMenus}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Sections
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.totalSections}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Items
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.totalItems}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Modifiers
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.totalModifiers}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Tax Tables
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.uniqueTaxRateCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Schedules
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.uniqueScheduleCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Priced Items
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.pricedItems}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                No Price
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.unpricedItems}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Featured
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.featuredItems}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Hidden
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.hiddenItems}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Alcohol
              </p>
              <p className="text-sm font-semibold">
                {menuAnalytics.alcoholItems}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Complete Menu Breakdown
              </CardTitle>
              <CardDescription>
                Detailed view of all menu items with prices, schedules, tax
                rates, and configurations
              </CardDescription>
            </div>
            <Button onClick={downloadJSON} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {menus.map((menu, menuIdx) => {
            const menuId = menu.MenuId || menu.PosId || `menu-${menuIdx}`;
            const isMenuExpanded = expandedMenus[menuId];
            const sections = menu.Sections || [];
            const taxInfo = getTaxRateInfo(menu.TaxRateId);
            const scheduleInfo = getScheduleInfo(menu.ScheduleId);

            return (
              <Card key={menuId} className="border-2">
                <Collapsible
                  open={isMenuExpanded}
                  onOpenChange={() => toggleMenu(menuId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isMenuExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">
                                {menu.Name || "Unnamed Menu"}
                              </h3>
                              {menuId.toUpperCase().includes("RNOO") && (
                                <Badge className="bg-semantic-success text-white">
                                  RNOO
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 font-mono">
                              {menuId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <p className="text-gray-500">
                              {sections.length} sections
                            </p>
                            <p className="text-gray-500">
                              {sections.reduce(
                                (sum, s) => sum + (s.Items?.length || 0),
                                0,
                              )}{" "}
                              items
                            </p>
                          </div>
                        </div>
                      </div>
                      {(taxInfo || scheduleInfo) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {taxInfo && (
                            <Badge variant="outline" className="text-xs">
                              <Percent className="w-3 h-3 mr-1" />
                              Tax: {taxInfo.name} ({taxInfo.rate})
                            </Badge>
                          )}
                          {scheduleInfo && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {scheduleInfo.name}: {scheduleInfo.days}{" "}
                              {scheduleInfo.start}-{scheduleInfo.end}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                      {sections.map((section, sectionIdx) => {
                        const sectionKey = `${menuId}-section-${sectionIdx}`;
                        const isSectionExpanded = expandedSections[sectionKey];
                        const items = section.Items || [];

                        return (
                          <Card key={sectionKey} className="border">
                            <Collapsible
                              open={isSectionExpanded}
                              onOpenChange={() => toggleSection(sectionKey)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isSectionExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                      )}
                                      <h4 className="font-semibold">
                                        {section.Name || "Unnamed Section"}
                                      </h4>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {items.length} items
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0 space-y-2">
                                  {items.map((item, itemIdx) => {
                                    const itemTaxInfo =
                                      getTaxRateInfo(item.TaxRateId) || taxInfo;
                                    const itemScheduleInfo =
                                      getScheduleInfo(item.ScheduleId) ||
                                      scheduleInfo;
                                    const prices = getItemPriceRows(item);
                                    const modifierGroups =
                                      getModifierGroups(item);
                                    const modifierCount = modifierGroups.reduce(
                                      (sum, group) =>
                                        sum + (group.options?.length || 0),
                                      0,
                                    );

                                    return (
                                      <Card
                                        key={itemIdx}
                                        className="bg-gray-50"
                                      >
                                        <CardContent className="p-4">
                                          <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                              <h5 className="font-semibold text-base">
                                                {item.Name || "Unnamed Item"}
                                              </h5>
                                              {item.Description && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                  {item.Description}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-right ml-4">
                                              {prices.length > 0 ? (
                                                <div className="space-y-1">
                                                  {prices.map((price) => (
                                                    <div key={price.id}>
                                                      <p className="font-semibold text-lg text-primary">
                                                        $
                                                        {price.amount.toFixed(
                                                          2,
                                                        )}
                                                      </p>
                                                      {price.name &&
                                                        price.name !==
                                                          "Default" && (
                                                          <p className="text-xs text-gray-500">
                                                            {price.name}
                                                          </p>
                                                        )}
                                                      {price.scheduleId && (
                                                        <Badge
                                                          variant="outline"
                                                          className="text-xs mt-1"
                                                        >
                                                          <Clock className="w-3 h-3 mr-1" />
                                                          {price.scheduleId}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-gray-400 text-sm">
                                                  No price
                                                </p>
                                              )}
                                            </div>
                                          </div>

                                          {/* Item Metadata */}
                                          <div className="flex flex-wrap gap-2 mt-3">
                                            <Badge
                                              variant="outline"
                                              className="text-xs font-mono"
                                            >
                                              ID:{" "}
                                              {item.ItemId ||
                                                item.Mid ||
                                                item.PosId ||
                                                "N/A"}
                                            </Badge>
                                            {itemTaxInfo && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                <Percent className="w-3 h-3 mr-1" />
                                                {itemTaxInfo.name} (
                                                {itemTaxInfo.rate})
                                              </Badge>
                                            )}
                                            {itemScheduleInfo && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                <Clock className="w-3 h-3 mr-1" />
                                                {itemScheduleInfo.name}
                                              </Badge>
                                            )}
                                            {item.Calories && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {item.Calories} cal
                                              </Badge>
                                            )}
                                          </div>

                                          {/* Modifiers */}
                                          {modifierCount > 0 && (
                                            <div className="mt-3 pt-3 border-t space-y-2">
                                              <p className="text-xs font-semibold text-gray-700">
                                                Modifiers ({modifierCount})
                                              </p>
                                              {modifierGroups.map((group) => (
                                                <div
                                                  key={group.id}
                                                  className="space-y-1"
                                                >
                                                  <p className="text-xs font-medium text-gray-600">
                                                    {group.name}
                                                    {(group.minMods > 0 ||
                                                      group.maxMods > 0) && (
                                                      <span className="ml-1 text-gray-500">
                                                        (min {group.minMods},
                                                        max{" "}
                                                        {group.maxMods ||
                                                          "unlimited"}
                                                        )
                                                      </span>
                                                    )}
                                                  </p>
                                                  <div className="space-y-1">
                                                    {group.options.map(
                                                      (mod) => (
                                                        <div
                                                          key={mod.id}
                                                          className="text-xs text-gray-600 flex items-center justify-between"
                                                        >
                                                          <span>
                                                            {mod.name}
                                                          </span>
                                                          {mod.price > 0 && (
                                                            <span className="text-primary font-semibold">
                                                              +$
                                                              {mod.price.toFixed(
                                                                2,
                                                              )}
                                                            </span>
                                                          )}
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Additional Properties */}
                                          {(item.IsAlcohol ||
                                            item.IsFeatured ||
                                            item.IsHidden) && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                              {item.IsAlcohol && (
                                                <Badge className="bg-amber-500 text-white text-xs">
                                                  Alcohol
                                                </Badge>
                                              )}
                                              {item.IsFeatured && (
                                                <Badge className="bg-blue-500 text-white text-xs">
                                                  Featured
                                                </Badge>
                                              )}
                                              {item.IsHidden && (
                                                <Badge
                                                  variant="secondary"
                                                  className="text-xs"
                                                >
                                                  Hidden
                                                </Badge>
                                              )}
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

const MerchantDetailPage = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [merchantData, setMerchantData] = useState(null);
  const [logoError, setLogoError] = useState(false);

  // CG Configuration state
  const [cgDialogOpen, setCgDialogOpen] = useState(false);
  const [cgValue, setCgValue] = useState("");
  const [savingCg, setSavingCg] = useState(false);

  // Frontend template state
  const [templateValue, setTemplateValue] = useState(DEFAULT_TEMPLATE);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const loadMerchantDetails = useCallback(async () => {
    try {
      setLoading(true);
      setLogoError(false);
      const res = await api.get(`/merchants/${merchantId}/shepherd-details`);
      setMerchantData(res.data);
    } catch (err) {
      console.error("Failed to load merchant details:", err);
      // Don't show error toast for Shepherd API issues (503) - it's optional
      if (err.response?.status !== 503) {
        toast.error(
          err.response?.data?.detail || "Failed to load merchant details",
        );
      }
      // Still set empty data so page doesn't break
      setMerchantData({});
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadMerchantDetails();
  }, [loadMerchantDetails]);

  // Initialize CG value when merchant data loads
  useEffect(() => {
    if (merchantData?.local_merchant?.shepherd_config?.rpower_cg) {
      setCgValue(merchantData.local_merchant.shepherd_config.rpower_cg);
    } else {
      setCgValue("");
    }
    setTemplateValue(
      merchantData?.local_merchant?.frontend_template || DEFAULT_TEMPLATE,
    );
  }, [merchantData]);

  const handleSyncMenu = async () => {
    try {
      setSyncing(true);
      await api.post(`/shepherd/sync-menu/${merchantId}`);
      toast.success("Menu synced successfully");
      loadMerchantDetails();
    } catch (err) {
      // Shepherd is optional - show info instead of error for 503
      if (err.response?.status === 503) {
        toast.info(
          "Shepherd API not configured. Shepherd sync features unavailable.",
        );
      } else {
        toast.error(err.response?.data?.detail || "Failed to sync menu");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveCgValue = async () => {
    try {
      setSavingCg(true);

      // Get existing shepherd_config or create new one
      const existingConfig =
        merchantData?.local_merchant?.shepherd_config || {};
      const updatedConfig = {
        ...existingConfig,
        rpower_cg: cgValue.trim() || null,
      };

      await api.patch(`/merchants/${merchantId}`, {
        shepherd_config: updatedConfig,
      });

      toast.success("RPOWER CG value saved successfully");
      setCgDialogOpen(false);
      loadMerchantDetails(); // Reload to get updated data
    } catch (err) {
      console.error("Failed to save CG value:", err);
      toast.error(err.response?.data?.detail || "Failed to save CG value");
    } finally {
      setSavingCg(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      setSavingTemplate(true);
      await api.patch(`/merchants/${merchantId}`, {
        frontend_template: templateValue,
      });
      toast.success("Frontend template updated");
      loadMerchantDetails();
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error(err.response?.data?.detail || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  if (!merchantData) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Merchant not found</h2>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/merchants")}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Merchants
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const {
    local_merchant,
    shepherd_data,
    shepherd_linked,
    shepherd_merchant_id,
    logo_url,
    site_summary,
  } = merchantData;
  const merchantInfo = shepherd_data?.merchant_info || {};
  const menuSummary = shepherd_data?.menu_summary || [];
  const taxRates = shepherd_data?.tax_rates || {};
  const coreTaxRates = shepherd_data?.rpower_tax_rates || {};
  const schedules = Array.isArray(shepherd_data?.schedules)
    ? shepherd_data.schedules
    : shepherd_data?.schedules?.schedules || [];

  const resolveCoreTaxRows = (coreTaxPayload) => {
    const payload = coreTaxPayload?.payload ?? coreTaxPayload;
    const candidates = [
      payload,
      payload?.TaxRates,
      payload?.tax_rates,
      payload?.taxRates,
      payload?.rates,
      payload?.data,
    ];
    const arrayData = candidates.find((entry) => Array.isArray(entry));
    if (!arrayData) return [];

    return arrayData.map((tax, idx) => ({
      id:
        tax?.TaxRateId ||
        tax?.Id ||
        tax?.tax_id ||
        tax?.taxId ||
        `core-tax-${idx}`,
      name: tax?.Name || tax?.name || tax?.tax_name || tax?.taxName || "N/A",
      rawRate: tax?.Rate ?? tax?.rate ?? tax?.tax_rate ?? tax?.taxRate,
      source: "core",
    }));
  };

  const formatTaxRate = (rawRate) => {
    if (rawRate === null || rawRate === undefined || rawRate === "")
      return "N/A";
    const numeric = Number(rawRate);
    if (Number.isNaN(numeric)) return String(rawRate);
    const percent = numeric <= 1 ? numeric * 100 : numeric;
    return `${percent.toFixed(2)}%`;
  };

  const shepherdTaxRows = (taxRates?.TaxRates || []).map((tax, idx) => ({
    id: tax?.TaxRateId || tax?.Id || `shepherd-tax-${idx}`,
    name: tax?.Name || tax?.TaxRateId || "N/A",
    rawRate: tax?.Rate,
    source: "shepherd",
  }));
  const coreTaxRows = resolveCoreTaxRows(coreTaxRates);
  const effectiveTaxRows =
    coreTaxRows.length > 0 ? coreTaxRows : shepherdTaxRows;

  // Format day string (NYYYYYN -> Mon-Fri)
  const formatDays = (daysStr) => {
    if (!daysStr) return "N/A";
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const active = days.filter((_, i) => daysStr[i] === "Y");
    if (active.length === 7) return "Every Day";
    if (active.length === 0) return "None";
    return active.join(", ");
  };

  const fieldLabelClass =
    "text-[11px] font-semibold uppercase tracking-wide text-gray-500";
  const fieldValueClass = "text-sm font-semibold text-gray-900 leading-tight";
  const fieldValueMonoClass =
    "text-sm font-semibold font-mono text-gray-900 leading-tight";

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-[1400px] mx-auto">
        {/* Header with Logo */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/merchants")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {logo_url && !logoError ? (
              <Avatar className="h-12 w-12 rounded-lg">
                <AvatarImage
                  src={logo_url}
                  alt={local_merchant?.name}
                  onError={() => setLogoError(true)}
                />
                <AvatarFallback className="rounded-lg bg-primary/10">
                  <Store className="w-6 h-6 text-primary" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-heading font-bold text-gray-900 truncate">
                {site_summary?.name ||
                  local_merchant?.name ||
                  "Merchant Details"}
              </h1>
              <p className="text-sm text-gray-500">
                {shepherd_linked ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-semantic-success" />
                    Shepherd ID: {shepherd_merchant_id}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-semantic-error" />
                    Not linked to Shepherd
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(`/order/${local_merchant?.slug}`, "_blank")
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Store
            </Button>
            {shepherd_linked && (
              <Button
                onClick={handleSyncMenu}
                disabled={syncing}
                size="sm"
                className="bg-primary hover:bg-primary-hover"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Menu
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500">RPOWER Version</p>
                <p className="font-semibold text-sm">
                  {site_summary?.rpower_version ||
                    merchantInfo.version ||
                    "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-accent-teal/10 rounded-md">
                <Monitor className="w-5 h-5 text-accent-teal" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Workstations</p>
                <p className="font-semibold">
                  {site_summary?.workstation_count || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-semantic-warning/10 rounded-md">
                <Menu className="w-5 h-5 text-semantic-warning" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Menus</p>
                <p className="font-semibold">{menuSummary.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-semantic-error/10 rounded-md">
                <Percent className="w-5 h-5 text-semantic-error" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Tax Rates</p>
                <p className="font-semibold">{effectiveTaxRows.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-semantic-success/10 rounded-md">
                <Clock className="w-5 h-5 text-semantic-success" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-semibold">
                  {local_merchant?.is_active ? "Active" : "Inactive"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Frontend Template Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-4 h-4" />
              Frontend Template
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 block mb-1">
                  Consumer Storefront Template
                </label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={templateValue}
                  onChange={(e) => setTemplateValue(e.target.value)}
                >
                  {TEMPLATE_LIST.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                      {t.description ? ` — ${t.description}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={
                  savingTemplate ||
                  templateValue ===
                    (local_merchant?.frontend_template || DEFAULT_TEMPLATE)
                }
              >
                {savingTemplate ? "Saving…" : "Save Template"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!shepherd_linked ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Not Linked to Shepherd
              </h3>
              <p className="text-gray-500 mb-4">
                Link this merchant to a Shepherd merchant ID to view POS data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="site" className="w-full">
            <TabsList className="w-full h-9 flex overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="site" className="text-xs px-3 shrink-0">
                Site Info
              </TabsTrigger>
              <TabsTrigger value="menus" className="text-xs px-3 shrink-0">
                Available Export Menu
              </TabsTrigger>
              <TabsTrigger value="fullmenu" className="text-xs px-3 shrink-0">
                Full Menu
              </TabsTrigger>
              <TabsTrigger value="schedules" className="text-xs px-3 shrink-0">
                Schedules
              </TabsTrigger>
              <TabsTrigger value="tax" className="text-xs px-3 shrink-0">
                Tax Rates
              </TabsTrigger>
            </TabsList>

            {/* Site Info Tab - HQDing Data */}
            <TabsContent value="site">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* License Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="w-5 h-5" />
                      License Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <label className={fieldLabelClass}>Serial Number</label>
                        <p className={fieldValueMonoClass}>
                          {site_summary?.serial_number ||
                            merchantInfo.sn ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Dealer Number</label>
                        <p className={fieldValueMonoClass}>
                          {site_summary?.dealer_number || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Licensed Users
                        </label>
                        <p className={fieldValueClass}>
                          {site_summary?.licensed_users || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Shepherd Merchant ID
                        </label>
                        <p className={fieldValueMonoClass}>
                          {shepherd_merchant_id}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* RPOWER Configuration - Editable CG */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        RPOWER Configuration
                      </span>
                      <Dialog
                        open={cgDialogOpen}
                        onOpenChange={setCgDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="edit-cg-button"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Configure RPOWER CG Value</DialogTitle>
                            <DialogDescription>
                              The CG (Customer Group) value is used to
                              authenticate with the RPOWER Core API for fetching
                              additional store information like addresses.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="cg-value">CG Value</Label>
                              <Input
                                id="cg-value"
                                data-testid="cg-input"
                                placeholder="e.g., 20550"
                                value={cgValue}
                                onChange={(e) => setCgValue(e.target.value)}
                              />
                              <p className="text-sm text-gray-500">
                                Enter the Customer Group code provided by RPOWER
                                for this merchant.
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setCgDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleSaveCgValue}
                              disabled={savingCg}
                              data-testid="save-cg-button"
                            >
                              {savingCg ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <label className={fieldLabelClass}>
                          RPOWER CG (Customer Group)
                        </label>
                        <p
                          className={fieldValueMonoClass}
                          data-testid="cg-display-value"
                        >
                          {local_merchant?.shepherd_config?.rpower_cg || (
                            <span className="text-gray-400 italic">
                              Not configured
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Clerk ID</label>
                        <p className={fieldValueMonoClass}>
                          {local_merchant?.shepherd_config?.clerk_id || "8888"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Concept ID</label>
                        <p className={fieldValueMonoClass}>
                          {local_merchant?.shepherd_config?.concept_id ||
                            "RNOO"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Merchant Link</label>
                        <p className={fieldValueMonoClass}>
                          {local_merchant?.shepherd_config?.merchant_id ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                    {!local_merchant?.shepherd_config?.rpower_cg && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <AlertCircle className="w-4 h-4 inline mr-1" />
                          Configure the CG value to enable fetching additional
                          store information from RPOWER Core API.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* System Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="w-5 h-5" />
                      System Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <label className={fieldLabelClass}>
                          RPOWER Version
                        </label>
                        <p className={fieldValueClass}>
                          {site_summary?.rpower_version || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Database Version
                        </label>
                        <p className={fieldValueClass}>
                          {site_summary?.database_version || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Windows Version
                        </label>
                        <p className={fieldValueClass}>
                          {site_summary?.windows_version || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>File Server</label>
                        <p className={fieldValueMonoClass}>
                          {site_summary?.file_server || "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building className="w-5 h-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabelClass}>Site Name</label>
                        <p className={fieldValueClass}>
                          {site_summary?.name || local_merchant?.name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Phone</label>
                        <p className={fieldValueClass}>
                          {site_summary?.phone ||
                            local_merchant?.phone ||
                            "N/A"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={fieldLabelClass}>
                          LAN IP Address
                        </label>
                        <p className={fieldValueMonoClass}>
                          {site_summary?.lan_ip || "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Store Address from RPOWER Core API */}
                {site_summary?.store_address && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="w-5 h-5" />
                        Store Address
                        <Badge variant="outline" className="ml-2 text-xs">
                          RPOWER Core
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div>
                        <label className={fieldLabelClass}>Address</label>
                        <p className={fieldValueClass}>
                          {site_summary.store_address.line1 || "N/A"}
                          {site_summary.store_address.line2 && (
                            <>
                              <br />
                              {site_summary.store_address.line2}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={fieldLabelClass}>City</label>
                          <p className={fieldValueClass}>
                            {site_summary.store_address.city || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className={fieldLabelClass}>State</label>
                          <p className={fieldValueClass}>
                            {site_summary.store_address.state || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className={fieldLabelClass}>Zip</label>
                          <p className={fieldValueClass}>
                            {site_summary.store_address.zip || "N/A"}
                          </p>
                        </div>
                      </div>
                      {site_summary.store_address.phone && (
                        <div>
                          <label className={fieldLabelClass}>Phone</label>
                          <p
                            className={`${fieldValueClass} flex items-center gap-1`}
                          >
                            <Phone className="w-4 h-4" />
                            {site_summary.store_address.phone}
                          </p>
                        </div>
                      )}
                      {site_summary.store_address.url && (
                        <div>
                          <label className={fieldLabelClass}>Website</label>
                          <p className={fieldValueClass}>
                            <a
                              href={`https://${site_summary.store_address.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {site_summary.store_address.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </p>
                        </div>
                      )}
                      {site_summary.rpower_timezone && (
                        <div>
                          <label className={fieldLabelClass}>Timezone</label>
                          <p className={fieldValueClass}>
                            {site_summary.rpower_timezone}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Last Sync Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-5 h-5" />
                      Last HQDing Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={fieldLabelClass}>Timestamp</label>
                        <p className={fieldValueClass}>
                          {site_summary?.last_hqding?.timestamp
                            ? new Date(
                                site_summary.last_hqding.timestamp,
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <label className={fieldLabelClass}>Timezone</label>
                        <p className={fieldValueClass}>
                          {site_summary?.last_hqding?.timezone || "N/A"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={fieldLabelClass}>
                          Last Menu Update
                        </label>
                        <p className={fieldValueClass}>
                          {merchantInfo.lastMenuUpdate
                            ? new Date(
                                merchantInfo.lastMenuUpdate,
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workstations */}
                {site_summary?.workstations?.length > 0 && (
                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Monitor className="w-5 h-5" />
                        Workstations ({site_summary.workstations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Computer Name</TableHead>
                            <TableHead>IP Address</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {site_summary.workstations.map((ws, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">
                                {ws.name || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {ws.computer_name || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {ws.ip || "N/A"}
                              </TableCell>
                              <TableCell>
                                {ws.status?.includes("ACTIVE") ? (
                                  <Badge className="bg-semantic-success/10 text-semantic-success">
                                    Active
                                  </Badge>
                                ) : ws.status?.includes("FILESVR") ? (
                                  <Badge className="bg-primary/10 text-primary">
                                    File Server
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    {ws.status || "Unknown"}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Menus Tab */}
            <TabsContent value="menus">
              <Card>
                <CardHeader>
                  <CardTitle>Available Export Menu</CardTitle>
                  <CardDescription>
                    Export menus available from Shepherd with schedule and tax
                    mapping
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {menuSummary.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Menu Name</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Tax Rate</TableHead>
                          <TableHead>Sections</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>RNOO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menuSummary.map((menu, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {menu.menu_name || "-"}
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                  {menu.menu_id}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {menu.schedule_id ? (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {menu.schedule_id}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">
                                  Always
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {menu.tax_rate_id ? (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  {menu.tax_rate_id}
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>{menu.section_count}</TableCell>
                            <TableCell>{menu.item_count}</TableCell>
                            <TableCell>
                              {menu.is_rnoo ? (
                                <Badge className="bg-semantic-success text-white">
                                  Yes
                                </Badge>
                              ) : (
                                <Badge variant="outline">No</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No menu data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Full Menu Tab - Detailed View */}
            <TabsContent value="fullmenu">
              <FullMenuViewer
                menuData={shepherd_data?.menu_data}
                taxRates={taxRates}
                schedules={schedules}
              />
            </TabsContent>

            {/* Schedules Tab */}
            <TabsContent value="schedules">
              <Card>
                <CardHeader>
                  <CardTitle>Schedules from Shepherd</CardTitle>
                  <CardDescription>
                    Time-based schedules for menu availability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {schedules.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Schedule Name</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>POS ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((schedule, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {schedule.name}
                            </TableCell>
                            <TableCell>
                              {formatDays(schedule.daysOfWeek)}
                            </TableCell>
                            <TableCell className="font-mono">
                              {schedule.start || "All Day"}
                            </TableCell>
                            <TableCell className="font-mono">
                              {schedule.end || "All Day"}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-gray-500">
                              {schedule.posId}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No schedule data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tax Rates Tab */}
            <TabsContent value="tax">
              <Card>
                <CardHeader>
                  <CardTitle>Tax Rates</CardTitle>
                  <CardDescription>
                    Core API tax data is preferred when available, with Shepherd
                    fallback.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {effectiveTaxRows.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {effectiveTaxRows.map((tax, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">
                              {tax.id}
                            </TableCell>
                            <TableCell>{tax.name}</TableCell>
                            <TableCell>{formatTaxRate(tax.rawRate)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {tax.source === "core"
                                  ? "Core API"
                                  : "Shepherd"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : coreTaxRates?.error ? (
                    <p className="text-semantic-error text-center py-8">
                      {coreTaxRates.error}
                    </p>
                  ) : taxRates.error ? (
                    <p className="text-semantic-error text-center py-8">
                      {taxRates.error}
                    </p>
                  ) : (
                    <p className="text-gray-500 text-center py-8">
                      No tax rate data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
};

export default MerchantDetailPage;
