import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService } from "../../context/AppContext";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Store,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock,
  ArrowUpRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Download,
  Trophy,
  Flame,
  Zap,
  ChevronDown,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  color = "primary",
  loading,
}) => (
  <Card className="border shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-1" />
          ) : (
            <p className="text-3xl font-heading font-bold mt-1">{value}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-semantic-success text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            color === "primary"
              ? "bg-primary/10 text-primary"
              : color === "success"
                ? "bg-semantic-success/10 text-semantic-success"
                : color === "warning"
                  ? "bg-semantic-warning/10 text-semantic-warning"
                  : "bg-semantic-info/10 text-semantic-info"
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const RecentOrderRow = ({ order }) => {
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    preparing: "bg-purple-100 text-purple-800",
    ready: "bg-green-100 text-green-800",
    delivered: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <p className="font-medium">Order #{order.order_number}</p>
          <p className="text-sm text-gray-500">{order.customer?.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">${order.total?.toFixed(2)}</p>
        <Badge className={statusColors[order.status] || statusColors.pending}>
          {order.status}
        </Badge>
      </div>
    </div>
  );
};

const LIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
]);

const getOrderItemCount = (order) =>
  (order?.items || []).reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0,
  );

const liveStatusStyles = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
};

const getCustomerSegment = (orderCount, daysSinceOrder) => {
  if (orderCount >= 5) return "Loyal";
  if (daysSinceOrder > 60 && orderCount > 1) return "At Risk";
  if (orderCount >= 2) return "Repeat";
  return "New";
};

const customerSegmentStyles = {
  Loyal: "bg-green-100 text-green-800",
  Repeat: "bg-blue-100 text-blue-800",
  New: "bg-purple-100 text-purple-800",
  "At Risk": "bg-amber-100 text-amber-800",
};

const LiveOrderExpoRow = ({ order, locationName }) => {
  const createdAt = order?.created_at ? new Date(order.created_at) : null;
  const createdText = createdAt
    ? createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Unknown time";
  const itemCount = getOrderItemCount(order);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            #{order.order_number || String(order.id).slice(-6)}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {order.customer?.name || "Guest"}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5 inline-flex items-center gap-1">
            <Store className="w-3 h-3" />
            {locationName || "Unknown Location"}
          </p>
        </div>
        <Badge
          className={
            liveStatusStyles[order.status] || "bg-gray-100 text-gray-700"
          }
        >
          {order.status}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
          <p className="text-gray-500">Total</p>
          <p className="font-semibold text-gray-900">
            ${Number(order.total || 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
          <p className="text-gray-500">Items</p>
          <p className="font-semibold text-gray-900">{itemCount}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
          <p className="text-gray-500">Placed</p>
          <p className="font-semibold text-gray-900">{createdText}</p>
        </div>
      </div>
    </div>
  );
};

const getMerchantLocationName = (merchant, merchantId) => {
  if (!merchant) {
    return merchantId ? `Merchant ${String(merchantId).slice(-4)}` : "Unknown";
  }

  return (
    merchant.license_name ||
    merchant.licenseName ||
    merchant.LicenseName ||
    merchant.location_name ||
    merchant.locationName ||
    merchant.LocationName ||
    merchant.location ||
    merchant.Location ||
    merchant.store_name ||
    merchant.storeName ||
    merchant.StoreName ||
    merchant.name ||
    merchant.Name ||
    (merchantId ? `Merchant ${String(merchantId).slice(-4)}` : "Unknown")
  );
};

const getItemLineRevenue = (item, menuPriceLookup = {}) => {
  const quantity = Number(item?.quantity) || 0;
  const modifierTotal = (item?.modifiers || []).reduce(
    (sum, modifier) => sum + Number(modifier?.price || 0),
    0,
  );
  const explicitUnitPrice = Number(
    item?.unit_price ?? item?.basePrice ?? item?.price,
  );
  const menuUnitPrice = Number(
    menuPriceLookup[item?.menu_item_id] ?? menuPriceLookup[item?.itemId],
  );
  const unitPrice =
    Number.isFinite(explicitUnitPrice) && explicitUnitPrice > 0
      ? explicitUnitPrice
      : Number.isFinite(menuUnitPrice)
        ? menuUnitPrice
        : 0;
  const explicitLineTotal = Number(
    item?.total_price ?? item?.totalPrice ?? NaN,
  );

  if (Number.isFinite(explicitLineTotal) && explicitLineTotal > 0) {
    return explicitLineTotal;
  }

  return (unitPrice + modifierTotal) * quantity;
};

const calculateRevenueTrend = (currentRevenue, previousRevenue) => {
  if (previousRevenue > 0) {
    return ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  }

  if (currentRevenue > 0) {
    return 100;
  }

  return 0;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [posHealth, setPosHealth] = useState({
    submitted: 0,
    failed: 0,
    pending: 0,
  });
  const [dateRange, setDateRange] = useState("7d"); // 7d, 30d, 90d, custom
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  // New: Enhanced metrics
  const [merchantMetrics, setMerchantMetrics] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [customerSegments, setCustomerSegments] = useState({
    newCustomers: 0,
    repeat: 0,
    loyal: 0,
    atRisk: 0,
    avgLTV: 0,
  });
  const [customerInsights, setCustomerInsights] = useState([]);
  const [ordersPerMinute, setOrdersPerMinute] = useState(0);
  const [customerInsightsDialogOpen, setCustomerInsightsDialogOpen] =
    useState(false);
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState("all");
  const [customerSort, setCustomerSort] = useState("top_spenders");
  const [liveOrdersDialogOpen, setLiveOrdersDialogOpen] = useState(false);

  // Merchant multi-select filter
  const [allOrders, setAllOrders] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantIds, setSelectedMerchantIds] = useState([]);
  const [merchantSelectorOpen, setMerchantSelectorOpen] = useState(false);
  const [filteredStats, setFilteredStats] = useState(null);
  const selectorRef = useRef(null);
  const menuPriceLookupRef = useRef({});

  const computeAnalytics = useCallback(
    (orders, merchantRecords = []) => {
      const merchantLookup = merchantRecords.reduce((lookup, merchant) => {
        lookup[merchant.id] = merchant;
        return lookup;
      }, {});
      const now = new Date();
      const currentPeriodStart = new Date(
        now.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      const previousPeriodStart = new Date(
        currentPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      // Order status breakdown
      const statusCounts = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
      };

      let posSubmitted = 0;
      let posFailed = 0;
      let posPending = 0;

      orders.forEach((order) => {
        statusCounts[order.status]++;

        if (order.shepherd_submitted) {
          posSubmitted++;
        } else if (order.shepherd_error) {
          posFailed++;
        } else {
          posPending++;
        }
      });

      const breakdown = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
        status,
      }));

      setStatusBreakdown(breakdown);
      setPosHealth({
        submitted: posSubmitted,
        failed: posFailed,
        pending: posPending,
      });

      // Revenue trend based on selected date range
      let startDate;
      let endDate;

      switch (dateRange) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "custom":
          startDate = customDateFrom
            ? new Date(customDateFrom)
            : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = customDateTo ? new Date(customDateTo) : now;
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }

      if (!endDate) {
        endDate = now;
      }

      // Calculate number of days in range
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const numPoints = Math.min(daysDiff, 30); // Max 30 data points for readability

      // Generate date points
      const datePoints = [];
      const interval = Math.max(1, Math.floor(daysDiff / numPoints));

      for (let i = 0; i < numPoints; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i * interval);
        if (date <= endDate) {
          datePoints.push(date.toISOString().split("T")[0]);
        }
      }

      const dailyRevenue = datePoints.map((date) => {
        const dayOrders = orders.filter((o) => o.created_at?.startsWith(date));
        const revenue = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        return {
          date: new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          revenue: parseFloat(revenue.toFixed(2)),
          orders: dayOrders.length,
        };
      });

      setChartData(dailyRevenue);

      // NEW: Calculate merchant metrics (top performing merchants)
      const merchantMap = {};
      orders.forEach((order) => {
        const merchantId = order.merchant_id || "unknown";
        const merchantRecord = merchantLookup[merchantId] || order.merchant;
        const merchantName = getMerchantLocationName(
          merchantRecord,
          merchantId,
        );

        if (!merchantMap[merchantId]) {
          merchantMap[merchantId] = {
            id: merchantId,
            name: merchantName,
            totalRevenue: 0,
            orderCount: 0,
            avgOrderValue: 0,
            currentPeriodRevenue: 0,
            previousPeriodRevenue: 0,
            trend: 0,
            rating: null, // Rating not yet implemented
          };
        }

        merchantMap[merchantId].totalRevenue += order.total || 0;
        merchantMap[merchantId].orderCount += 1;
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        if (orderDate && orderDate >= currentPeriodStart) {
          merchantMap[merchantId].currentPeriodRevenue += order.total || 0;
        } else if (orderDate && orderDate >= previousPeriodStart) {
          merchantMap[merchantId].previousPeriodRevenue += order.total || 0;
        }
        merchantMap[merchantId].avgOrderValue =
          merchantMap[merchantId].orderCount > 0
            ? merchantMap[merchantId].totalRevenue /
              merchantMap[merchantId].orderCount
            : 0;
        merchantMap[merchantId].trend = calculateRevenueTrend(
          merchantMap[merchantId].currentPeriodRevenue,
          merchantMap[merchantId].previousPeriodRevenue,
        );
      });

      // Sort merchants by total revenue
      const metrics = Object.values(merchantMap).sort(
        (a, b) => b.totalRevenue - a.totalRevenue,
      );
      setMerchantMetrics(metrics);

      // NEW: Calculate top selling items
      const itemMap = {};
      orders.forEach((order) => {
        order.items?.forEach((item) => {
          const quantity = Number(item.quantity) || 0;
          const lineRevenue = getItemLineRevenue(
            item,
            menuPriceLookupRef.current,
          );

          if (!itemMap[item.name]) {
            itemMap[item.name] = {
              name: item.name,
              count: 0,
              revenue: 0,
              avgPrice: 0,
            };
          }
          itemMap[item.name].count += quantity;
          itemMap[item.name].revenue += lineRevenue;
        });
      });

      const topItemsList = Object.values(itemMap)
        .map((item) => ({
          ...item,
          revenue: Number(item.revenue.toFixed(2)),
          avgPrice:
            item.count > 0 ? Number((item.revenue / item.count).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setTopItems(topItemsList);

      // NEW: Calculate customer segments
      const customerMap = {};
      orders.forEach((order) => {
        const customerName =
          order.customer?.name || order.customer?.full_name || "Guest";
        const customerId =
          order.customer?.id ||
          order.customer?.phone ||
          order.customer?.email ||
          `${customerName}-${order.merchant_id || "unknown"}`;
        const merchantRecord =
          merchantLookup[order.merchant_id] || order.merchant || null;
        const merchantName = getMerchantLocationName(
          merchantRecord,
          order.merchant_id,
        );
        const orderDate = order.created_at ? new Date(order.created_at) : null;

        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            id: customerId,
            name: customerName,
            phone: order.customer?.phone || "",
            email: order.customer?.email || "",
            orders: [],
            totalSpent: 0,
            lastOrderDate: null,
            lastMerchantName: merchantName,
            locations: new Set(),
            locationStats: {},
          };
        }
        customerMap[customerId].orders.push(order);
        customerMap[customerId].totalSpent += order.total || 0;
        if (merchantName) {
          customerMap[customerId].locations.add(merchantName);
          if (!customerMap[customerId].locationStats[merchantName]) {
            customerMap[customerId].locationStats[merchantName] = {
              location: merchantName,
              orderCount: 0,
              totalSpent: 0,
              lastOrderDate: null,
            };
          }

          const locationEntry =
            customerMap[customerId].locationStats[merchantName];
          locationEntry.orderCount += 1;
          locationEntry.totalSpent += Number(order.total || 0);

          if (
            orderDate &&
            (!locationEntry.lastOrderDate ||
              orderDate > locationEntry.lastOrderDate)
          ) {
            locationEntry.lastOrderDate = orderDate;
          }
        }
        if (
          orderDate &&
          (!customerMap[customerId].lastOrderDate ||
            orderDate > customerMap[customerId].lastOrderDate)
        ) {
          customerMap[customerId].lastOrderDate = orderDate;
          customerMap[customerId].lastMerchantName = merchantName;
        }
      });

      let newCount = 0;
      let repeatCount = 0;
      let loyalCount = 0;
      let atRiskCount = 0;
      let totalLTV = 0;

      Object.values(customerMap).forEach((customer) => {
        const orderCount = customer.orders.length;

        if (orderCount === 1) {
          newCount++;
        } else if (orderCount >= 5) {
          loyalCount++;
        } else if (orderCount >= 2) {
          repeatCount++;
        }

        // At-risk: hasn't ordered in 60+ days
        const daysSinceOrder =
          (Date.now() - customer.lastOrderDate) / (1000 * 60 * 60 * 24);
        if (daysSinceOrder > 60 && orderCount > 1) {
          atRiskCount++;
        }

        // Calculate LTV
        const avgOrderValue = customer.totalSpent / orderCount;
        const purchaseFrequency = orderCount / 180; // Assuming 180 days of data
        totalLTV += avgOrderValue * purchaseFrequency * 365;
      });

      const avgLTV =
        Object.keys(customerMap).length > 0
          ? totalLTV / Object.keys(customerMap).length
          : 0;

      setCustomerSegments({
        newCustomers: newCount,
        repeat: repeatCount,
        loyal: loyalCount,
        atRisk: atRiskCount,
        avgLTV: Math.round(avgLTV),
      });

      const customerInsightsRows = Object.values(customerMap)
        .map((customer) => {
          const orderCount = customer.orders.length;
          const daysSinceOrder = customer.lastOrderDate
            ? (Date.now() - customer.lastOrderDate.getTime()) /
              (1000 * 60 * 60 * 24)
            : Number.POSITIVE_INFINITY;
          const segment = getCustomerSegment(orderCount, daysSinceOrder);

          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            orderCount,
            totalSpent: Number(customer.totalSpent.toFixed(2)),
            avgOrderValue:
              orderCount > 0
                ? Number((customer.totalSpent / orderCount).toFixed(2))
                : 0,
            segment,
            lastOrderDate: customer.lastOrderDate,
            lastMerchantName: customer.lastMerchantName,
            locations: Array.from(customer.locations),
            locationCount: customer.locations.size,
            locationBreakdown: Object.values(customer.locationStats)
              .map((entry) => ({
                location: entry.location,
                orderCount: entry.orderCount,
                totalSpent: Number(entry.totalSpent.toFixed(2)),
                avgOrderValue:
                  entry.orderCount > 0
                    ? Number((entry.totalSpent / entry.orderCount).toFixed(2))
                    : 0,
                lastOrderDate: entry.lastOrderDate,
              }))
              .sort((a, b) => b.orderCount - a.orderCount),
          };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 100);

      setCustomerInsights(customerInsightsRows);

      // Calculate orders per minute (average from last hour of data)
      const lastHourOrders = orders.filter((o) => {
        const orderTime = new Date(o.created_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return orderTime > oneHourAgo;
      });

      setOrdersPerMinute((lastHourOrders.length / 60).toFixed(1));
    },
    [dateRange, customDateFrom, customDateTo],
  );

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // Load stats based on role
        if (user?.role === "super_admin") {
          const [statsRes, merchantsRes] = await Promise.all([
            apiService.getAdminStats(),
            apiService.getMerchants(),
          ]);
          setStats(statsRes.data);
          setMerchants(merchantsRes.data || []);

          const orderParams = { limit: 200 };
          const ordersRes = await apiService.getOrders(orderParams);
          const ordersData = ordersRes.data.orders || ordersRes.data;
          const merchantIds = [
            ...new Set(ordersData.map((o) => o.merchant_id)),
          ].filter(Boolean);
          const menuResponses = await Promise.all(
            merchantIds.map(async (merchantId) => {
              try {
                const response = await apiService.getMenuItems(merchantId);
                return response.data || [];
              } catch (error) {
                console.error(
                  `Failed to load menu items for merchant ${merchantId}:`,
                  error,
                );
                return [];
              }
            }),
          );

          menuPriceLookupRef.current = menuResponses
            .flat()
            .reduce((lookup, item) => {
              if (item?.id) {
                lookup[item.id] = Number(item.price) || 0;
              }
              return lookup;
            }, {});

          setAllOrders(ordersData);
          setRecentOrders(ordersData.slice(0, 5));
          computeAnalytics(ordersData, merchantsRes.data || []);
          return;
        } else {
          const statsRes = await apiService.getStats(user?.merchant_id);
          setStats(statsRes.data);
        }

        // Load orders for analytics (without date filtering for now)
        const orderParams = { limit: 200 };
        const ordersRes = await apiService.getOrders(orderParams);
        const ordersData = ordersRes.data.orders || ordersRes.data;

        setAllOrders(ordersData);
        setRecentOrders(ordersData.slice(0, 5));

        // Compute analytics from orders
        computeAnalytics(ordersData, merchants);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user, computeAnalytics]);

  const exportChartData = async () => {
    try {
      setExporting(true);

      // Prepare CSV data
      const csvData = chartData.map((item) => ({
        Date: item.date,
        Revenue: item.revenue,
        Orders: item.orders,
      }));

      // Add summary row
      const totalRevenue = chartData.reduce(
        (sum, item) => sum + item.revenue,
        0,
      );
      const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
      csvData.push({
        Date: "TOTAL",
        Revenue: totalRevenue,
        Orders: totalOrders,
      });

      // Convert to CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          headers.map((header) => `"${row[header]}"`).join(","),
        ),
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `dashboard-analytics-${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Analytics data exported successfully");
    } catch (err) {
      console.error("Failed to export data:", err);
      toast.error("Failed to export analytics data");
    } finally {
      setExporting(false);
    }
  };

  // Re-filter whenever selection or allOrders changes
  useEffect(() => {
    if (allOrders.length === 0) return;
    const filtered =
      selectedMerchantIds.length === 0
        ? allOrders
        : allOrders.filter((o) => selectedMerchantIds.includes(o.merchant_id));
    setRecentOrders(filtered.slice(0, 5));
    computeAnalytics(filtered, merchants);
    if (selectedMerchantIds.length > 0) {
      setFilteredStats({
        total_orders: filtered.length,
        total_revenue: filtered.reduce((s, o) => s + (o.total || 0), 0),
        active_orders: filtered.filter(
          (o) => !["delivered", "cancelled"].includes(o.status),
        ).length,
        total_merchants: new Set(filtered.map((o) => o.merchant_id)).size,
      });
    } else {
      setFilteredStats(null);
    }
  }, [selectedMerchantIds, allOrders, computeAnalytics]);

  // Close selector on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setMerchantSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMerchant = (id) => {
    setSelectedMerchantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllMerchants = () => {
    setSelectedMerchantIds([]);
    setMerchantSelectorOpen(false);
  };

  const displayStats = filteredStats || stats;
  const isSuperAdmin = user?.role === "super_admin";
  const merchantsById = merchants.reduce((lookup, merchant) => {
    lookup[merchant.id] = merchant;
    return lookup;
  }, {});
  const filteredOrdersForView =
    selectedMerchantIds.length === 0
      ? allOrders
      : allOrders.filter((o) => selectedMerchantIds.includes(o.merchant_id));
  const liveOrders = filteredOrdersForView
    .filter((order) => LIVE_ORDER_STATUSES.has(order.status))
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
  const filteredCustomerInsights = useMemo(() => {
    const base =
      customerSegmentFilter === "all"
        ? customerInsights
        : customerInsights.filter((c) => c.segment === customerSegmentFilter);

    const next = [...base];
    if (customerSort === "top_spenders") {
      next.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (customerSort === "recent_activity") {
      next.sort(
        (a, b) =>
          new Date(b.lastOrderDate || 0).getTime() -
          new Date(a.lastOrderDate || 0).getTime(),
      );
    } else if (customerSort === "highest_aov") {
      next.sort((a, b) => b.avgOrderValue - a.avgOrderValue);
    }

    return next;
  }, [customerInsights, customerSegmentFilter, customerSort]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Merchant Multi-Select Filter (super_admin only) */}
            {isSuperAdmin && merchants.length > 0 && (
              <div className="relative" ref={selectorRef}>
                <button
                  onClick={() => setMerchantSelectorOpen((o) => !o)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
                    selectedMerchantIds.length > 0
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {selectedMerchantIds.length === 0
                    ? "All Merchants"
                    : selectedMerchantIds.length === 1
                      ? getMerchantLocationName(
                          merchants.find(
                            (m) => m.id === selectedMerchantIds[0],
                          ),
                          selectedMerchantIds[0],
                        ) || "1 Merchant"
                      : `${selectedMerchantIds.length} Merchants`}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      merchantSelectorOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {merchantSelectorOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {/* ALL option */}
                    <div
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
                        selectedMerchantIds.length === 0 ? "bg-primary/5" : ""
                      }`}
                      onClick={selectAllMerchants}
                    >
                      <Checkbox
                        checked={selectedMerchantIds.length === 0}
                        onCheckedChange={selectAllMerchants}
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        All Merchants
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {merchants.length} total
                      </span>
                    </div>

                    {/* Merchant list */}
                    <div className="max-h-64 overflow-y-auto">
                      {merchants.map((m) => (
                        <div
                          key={m.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${
                            selectedMerchantIds.includes(m.id)
                              ? "bg-primary/5"
                              : ""
                          }`}
                          onClick={() => toggleMerchant(m.id)}
                        >
                          <Checkbox
                            checked={selectedMerchantIds.includes(m.id)}
                            onCheckedChange={() => toggleMerchant(m.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {getMerchantLocationName(m, m.id)}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {m.slug}
                            </p>
                          </div>
                          {m.is_active ? (
                            <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    {selectedMerchantIds.length > 0 && (
                      <div className="border-t border-gray-100 px-4 py-2 flex justify-between items-center bg-gray-50">
                        <span className="text-xs text-gray-500">
                          {selectedMerchantIds.length} selected
                        </span>
                        <button
                          className="text-xs text-primary font-semibold hover:underline"
                          onClick={selectAllMerchants}
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              className="bg-primary hover:bg-primary-hover"
              onClick={() => navigate("/admin/orders")}
              data-testid="view-all-orders-btn"
            >
              View All Orders
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Active filter banner */}
        {isSuperAdmin && selectedMerchantIds.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-gray-700">
              Showing data for{" "}
              <span className="font-semibold text-primary">
                {selectedMerchantIds.length === 1
                  ? getMerchantLocationName(
                      merchants.find((m) => m.id === selectedMerchantIds[0]),
                      selectedMerchantIds[0],
                    )
                  : `${selectedMerchantIds.length} merchants`}
              </span>
            </span>
            <button
              className="ml-auto text-xs text-primary font-semibold hover:underline"
              onClick={selectAllMerchants}
            >
              Show all
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isSuperAdmin ? (
            <>
              <StatCard
                title="Total Merchants"
                value={
                  displayStats?.total_merchants ?? stats?.total_merchants ?? 0
                }
                icon={Store}
                color="info"
                loading={loading}
              />
              <StatCard
                title="Total Orders"
                value={displayStats?.total_orders ?? 0}
                icon={ShoppingCart}
                color="success"
                loading={loading}
              />
              <StatCard
                title="Total Revenue"
                value={`$${(displayStats?.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={DollarSign}
                color="warning"
                loading={loading}
              />
              <StatCard
                title="Active Orders"
                value={displayStats?.active_orders ?? 0}
                icon={Activity}
                color="primary"
                loading={loading}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Today's Orders"
                value={stats?.today_orders || 0}
                icon={ShoppingCart}
                color="primary"
                loading={loading}
              />
              <StatCard
                title="Pending Orders"
                value={stats?.pending_orders || 0}
                icon={Clock}
                color="warning"
                loading={loading}
              />
              <StatCard
                title="Today's Revenue"
                value={`$${(stats?.today_revenue || 0).toFixed(2)}`}
                icon={DollarSign}
                color="success"
                loading={loading}
              />
              <StatCard
                title="Total Revenue"
                value={`$${(stats?.total_revenue || 0).toLocaleString()}`}
                icon={TrendingUp}
                color="info"
                loading={loading}
              />
            </>
          )}
        </div>

        {/* NEW: Enhanced Metrics Section */}
        {isSuperAdmin && (
          <>
            {/* Real-Time Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Card
                  className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                  role="button"
                  tabIndex={0}
                  onClick={() => setLiveOrdersDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLiveOrdersDialogOpen(true);
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-green-600 font-bold tracking-wider">
                          🔴 LIVE ORDERS
                        </p>
                        <p className="text-4xl font-heading font-bold mt-2 text-green-700">
                          {liveOrders.length}
                        </p>
                        <p className="text-sm text-green-600 mt-3 font-semibold">
                          +{ordersPerMinute} orders/min
                        </p>
                        <p className="text-xs text-green-700/80 mt-1">
                          Click for expo view
                        </p>
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-3 bg-white rounded-lg shadow"
                      >
                        <Zap className="w-8 h-8 text-green-500" />
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Card
                  className="border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 cursor-pointer hover:shadow-lg transition-shadow"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCustomerInsightsDialogOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setCustomerInsightsDialogOpen(true);
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">
                          Total Customers
                        </p>
                        <p className="text-4xl font-heading font-bold mt-2 text-blue-700">
                          {customerInsights.length}
                        </p>
                        <p className="text-sm text-blue-600 mt-3">
                          Avg Lifetime Value:{" "}
                          <span className="font-bold">
                            ${customerSegments.avgLTV}
                          </span>
                        </p>
                        <p className="text-xs text-blue-700/80 mt-1">
                          Click for customer insights
                        </p>
                      </div>
                      <Users className="w-10 h-10 text-blue-400 opacity-40" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-purple-600 font-medium">
                          Order Success Rate
                        </p>
                        <p className="text-4xl font-heading font-bold mt-2 text-purple-700">
                          {stats?.total_orders > 0
                            ? Math.round(
                                (posHealth.submitted /
                                  (posHealth.submitted +
                                    posHealth.failed +
                                    posHealth.pending)) *
                                  100,
                              )
                            : 0}
                          %
                        </p>
                        <p className="text-sm text-purple-600 mt-3">
                          {posHealth.submitted + posHealth.pending} orders in
                          transit
                        </p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-purple-400 opacity-40" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Top Merchants & Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Merchants */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="border shadow-sm h-full">
                  <CardHeader>
                    <CardTitle className="font-heading flex items-center gap-2 text-lg">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Top Performing Merchants
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {merchantMetrics.length > 0 ? (
                      merchantMetrics.slice(0, 5).map((merchant, idx) => (
                        <motion.div
                          key={merchant.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.1 }}
                          className={`flex items-center justify-between rounded-xl border transition-colors ${
                            idx === 0
                              ? "p-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-white border-yellow-300 shadow-sm"
                              : "p-3 bg-gradient-to-r from-gray-50 to-gray-25 border-gray-100 hover:border-yellow-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold px-2.5 py-1">
                              #{idx + 1}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-gray-900 ${
                                  idx === 0
                                    ? "text-base font-bold"
                                    : "text-sm font-semibold"
                                }`}
                              >
                                {merchant.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {merchant.orderCount} orders • Avg: $
                                {(
                                  merchant.totalRevenue / merchant.orderCount
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-bold text-gray-900 ${
                                idx === 0 ? "text-2xl leading-none" : "text-lg"
                              }`}
                            >
                              $
                              {merchant.totalRevenue.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p
                              className={`text-xs font-semibold ${merchant.trend > 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {merchant.trend > 0 ? "↑" : "↓"}{" "}
                              {Math.abs(merchant.trend).toFixed(1)}%
                            </p>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No merchant data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top Selling Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card className="border shadow-sm h-full">
                  <CardHeader>
                    <CardTitle className="font-heading flex items-center gap-2 text-lg">
                      <Flame className="w-5 h-5 text-orange-500" />
                      Top Selling Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topItems.length > 0 ? (
                      topItems.slice(0, 5).map((item, idx) => (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + idx * 0.1 }}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-25 rounded-lg border border-orange-100 hover:border-orange-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-lg font-bold text-orange-500">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.count} sold
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-green-600">
                              $
                              {item.revenue.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.count} sold • ${item.avgPrice.toFixed(2)}/ea
                            </p>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>No item data available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Customer Segments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 font-medium">
                      New Customers
                    </p>
                    <p className="text-3xl font-heading font-bold text-blue-600 mt-2">
                      {customerSegments.newCustomers}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      First time buyers
                    </p>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 font-medium">
                      Repeat Customers
                    </p>
                    <p className="text-3xl font-heading font-bold text-green-600 mt-2">
                      {customerSegments.repeat}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">2-4 purchases</p>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 font-medium">
                      Loyal Customers
                    </p>
                    <p className="text-3xl font-heading font-bold text-purple-600 mt-2">
                      {customerSegments.loyal}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">5+ purchases</p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-400 bg-orange-50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="text-xs text-orange-700 font-medium">
                      ⚠️ At-Risk
                    </p>
                    <p className="text-3xl font-heading font-bold text-orange-600 mt-2">
                      {customerSegments.atRisk}
                    </p>
                    <p className="text-xs text-orange-600 mt-2">
                      No activity 60+ days
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </>
        )}

        {/* Analytics Section */}
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="font-heading">Analytics Controls</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                {dateRange === "custom" && (
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="w-32"
                      placeholder="From"
                    />
                    <Input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="w-32"
                      placeholder="To"
                    />
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={exportChartData}
                  disabled={exporting || loading}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? "Exporting..." : "Export CSV"}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend Chart */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Revenue Trend (
                {dateRange === "7d"
                  ? "Last 7 Days"
                  : dateRange === "30d"
                    ? "Last 30 Days"
                    : dateRange === "90d"
                      ? "Last 90 Days"
                      : "Custom Range"}
                )
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      dot={{ fill: "#7C3AED", r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Revenue ($)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Order Status Breakdown */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Order Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : statusBreakdown.filter((s) => s.value > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown.filter((s) => s.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#7C3AED" />
                      <Cell fill="#3B82F6" />
                      <Cell fill="#8B5CF6" />
                      <Cell fill="#10B981" />
                      <Cell fill="#F59E0B" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No order data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* POS Health Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border shadow-sm bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    POS Submitted
                  </p>
                  <p className="text-3xl font-heading font-bold mt-2 text-green-700">
                    {posHealth.submitted}
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    POS Pending
                  </p>
                  <p className="text-3xl font-heading font-bold mt-2 text-yellow-700">
                    {posHealth.pending}
                  </p>
                </div>
                <Clock className="w-12 h-12 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    POS Failed
                  </p>
                  <p className="text-3xl font-heading font-bold mt-2 text-red-700">
                    {posHealth.failed}
                  </p>
                </div>
                <XCircle className="w-12 h-12 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders */}
          <Card className="lg:col-span-2 border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading">Recent Orders</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/orders")}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24 mt-1" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-1">
                  {recentOrders.map((order) => (
                    <RecentOrderRow key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isSuperAdmin && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate("/admin/merchants")}
                    data-testid="quick-manage-merchants-btn"
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Manage Merchants
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/admin/orders")}
                data-testid="quick-view-orders-btn"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                View Orders
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  window.open("/order/demo-burger-joint", "_blank")
                }
                data-testid="quick-view-storefront-btn"
              >
                <Store className="w-4 h-4 mr-2" />
                View Storefront
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog
          open={liveOrdersDialogOpen}
          onOpenChange={setLiveOrdersDialogOpen}
        >
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Live Orders Expo View
              </DialogTitle>
              <DialogDescription>
                High-level live queue with current status, check total, and item
                count.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                <p className="text-xs text-green-700">Live Orders</p>
                <p className="text-lg font-bold text-green-800">
                  {liveOrders.length}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                <p className="text-xs text-blue-700">Preparing</p>
                <p className="text-lg font-bold text-blue-800">
                  {liveOrders.filter((o) => o.status === "preparing").length}
                </p>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-100 p-2.5">
                <p className="text-xs text-purple-700">Ready</p>
                <p className="text-lg font-bold text-purple-800">
                  {liveOrders.filter((o) => o.status === "ready").length}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
              {liveOrders.length > 0 ? (
                liveOrders.map((order) => (
                  <LiveOrderExpoRow
                    key={order.id}
                    order={order}
                    locationName={getMerchantLocationName(
                      order?.merchant || merchantsById[order?.merchant_id],
                      order?.merchant_id,
                    )}
                  />
                ))
              ) : (
                <div className="py-10 text-center text-gray-500">
                  No live orders right now.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => navigate("/admin/orders")}
                className="bg-primary hover:bg-primary-hover"
              >
                Open Full Orders Board
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={customerInsightsDialogOpen}
          onOpenChange={setCustomerInsightsDialogOpen}
        >
          <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Customer Insights View
              </DialogTitle>
              <DialogDescription>
                High-level customer breakdown with segment, spend, orders, and
                latest location activity.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
              <div className="rounded-lg bg-purple-50 border border-purple-100 p-2.5">
                <p className="text-xs text-purple-700">New</p>
                <p className="text-lg font-bold text-purple-800">
                  {customerSegments.newCustomers}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                <p className="text-xs text-blue-700">Repeat</p>
                <p className="text-lg font-bold text-blue-800">
                  {customerSegments.repeat}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                <p className="text-xs text-green-700">Loyal</p>
                <p className="text-lg font-bold text-green-800">
                  {customerSegments.loyal}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5">
                <p className="text-xs text-amber-700">At Risk</p>
                <p className="text-lg font-bold text-amber-800">
                  {customerSegments.atRisk}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "Loyal", label: "Loyal" },
                  { value: "Repeat", label: "Repeat" },
                  { value: "New", label: "New" },
                  { value: "At Risk", label: "At Risk" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCustomerSegmentFilter(filter.value)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                      customerSegmentFilter === filter.value
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-52">
                <Select value={customerSort} onValueChange={setCustomerSort}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top_spenders">Top Spenders</SelectItem>
                    <SelectItem value="recent_activity">
                      Recent Activity
                    </SelectItem>
                    <SelectItem value="highest_aov">Highest AOV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-2">
              Showing {filteredCustomerInsights.length} customer
              {filteredCustomerInsights.length !== 1 ? "s" : ""}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-2">
              {filteredCustomerInsights.length > 0 ? (
                filteredCustomerInsights.map((customer) => {
                  const lastOrderText = customer.lastOrderDate
                    ? new Date(customer.lastOrderDate).toLocaleDateString()
                    : "N/A";
                  const latestLocation = customer.lastMerchantName || "Unknown";
                  const locationBreakdown = customer.locationBreakdown || [];

                  return (
                    <div
                      key={customer.id}
                      className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {customer.name || "Guest"}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {customer.phone ||
                              customer.email ||
                              "No contact info"}
                          </p>
                        </div>
                        <Badge
                          className={
                            customerSegmentStyles[customer.segment] ||
                            "bg-gray-100 text-gray-700"
                          }
                        >
                          {customer.segment}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs sm:text-sm">
                        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="text-gray-500">Orders</p>
                          <p className="font-semibold text-gray-900">
                            {customer.orderCount}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="text-gray-500">Spend</p>
                          <p className="font-semibold text-gray-900">
                            ${customer.totalSpent.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="text-gray-500">AOV</p>
                          <p className="font-semibold text-gray-900">
                            ${customer.avgOrderValue.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="text-gray-500">Last Order</p>
                          <p className="font-semibold text-gray-900">
                            {lastOrderText}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                          <p className="text-gray-500">Locations</p>
                          {customer.locationCount > 1 ? (
                            <>
                              <p className="font-semibold text-gray-900">
                                {customer.locationCount} locations
                              </p>
                              <p className="mt-0.5 text-[11px] italic font-normal text-gray-700 whitespace-normal break-words leading-snug">
                                latest: {latestLocation}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold text-gray-900 whitespace-normal break-words leading-snug">
                              {latestLocation}
                            </p>
                          )}
                        </div>
                      </div>

                      {customer.locationCount > 1 && (
                        <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2">
                          <p className="text-gray-500 text-xs mb-1.5">
                            Location Breakdown
                          </p>

                          <div className="hidden sm:grid grid-cols-5 gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <p>Location</p>
                            <p>Orders</p>
                            <p>Spend</p>
                            <p>AOV</p>
                            <p>Last Order</p>
                          </div>

                          <div className="space-y-1">
                            {locationBreakdown.length > 0 ? (
                              locationBreakdown.map((entry) => {
                                const locationLastOrderText =
                                  entry.lastOrderDate
                                    ? new Date(
                                        entry.lastOrderDate,
                                      ).toLocaleDateString()
                                    : "N/A";

                                return (
                                  <div
                                    key={`${customer.id}-${entry.location}`}
                                    className="rounded-md border border-slate-200 bg-white p-2"
                                  >
                                    <div className="sm:hidden space-y-1 text-xs">
                                      <p className="font-semibold text-gray-900 break-words">
                                        {entry.location}
                                      </p>
                                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700">
                                        <p>Orders: {entry.orderCount}</p>
                                        <p>
                                          Spend: ${entry.totalSpent.toFixed(2)}
                                        </p>
                                        <p>
                                          AOV: ${entry.avgOrderValue.toFixed(2)}
                                        </p>
                                        <p>Last: {locationLastOrderText}</p>
                                      </div>
                                    </div>

                                    <div className="hidden sm:grid sm:grid-cols-5 gap-2 text-xs text-gray-800 items-start">
                                      <p className="font-semibold break-words">
                                        {entry.location}
                                      </p>
                                      <p>{entry.orderCount}</p>
                                      <p>${entry.totalSpent.toFixed(2)}</p>
                                      <p>${entry.avgOrderValue.toFixed(2)}</p>
                                      <p>{locationLastOrderText}</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-gray-500">
                                No location activity
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-gray-500">
                  No customer insights available.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
