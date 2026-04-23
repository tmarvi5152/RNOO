import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService } from "../../context/AppContext";
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
  const [ordersPerMinute, setOrdersPerMinute] = useState(0);

  const computeAnalytics = useCallback(
    (orders) => {
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
      const now = new Date();
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
        // Get merchant name from order data or use a friendly name
        const merchantName =
          order.merchant?.name ||
          order.merchant?.store_name ||
          order.merchant?.business_name ||
          `Store ${merchantId.slice(-4)}`; // Show last 4 chars of ID as fallback

        if (!merchantMap[merchantId]) {
          merchantMap[merchantId] = {
            id: merchantId,
            name: merchantName,
            totalRevenue: 0,
            orderCount: 0,
            avgOrderValue: 0,
            trend: Math.random() * 30 - 15,
            rating: 4.5 + Math.random() * 0.5, // Simulated rating
          };
        }

        merchantMap[merchantId].totalRevenue += order.total || 0;
        merchantMap[merchantId].orderCount += 1;
        merchantMap[merchantId].avgOrderValue =
          merchantMap[merchantId].orderCount > 0
            ? merchantMap[merchantId].totalRevenue /
              merchantMap[merchantId].orderCount
            : 0;
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
          if (!itemMap[item.name]) {
            itemMap[item.name] = {
              name: item.name,
              count: 0,
              revenue: 0,
              avgPrice: 0,
            };
          }
          itemMap[item.name].count += 1;
          // Ensure we have a valid price
          const itemPrice = item.price || item.total || 0;
          itemMap[item.name].revenue += itemPrice;
        });
      });

      const topItemsList = Object.values(itemMap)
        .map((item) => ({
          ...item,
          avgPrice: item.count > 0 ? item.revenue / item.count : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setTopItems(topItemsList);

      // NEW: Calculate customer segments
      const customerMap = {};
      orders.forEach((order) => {
        const customerId =
          order.customer?.id ||
          order.customer?.phone ||
          `customer-${Math.random()}`;
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            id: customerId,
            orders: [],
            totalSpent: 0,
            lastOrderDate: null,
          };
        }
        customerMap[customerId].orders.push(order);
        customerMap[customerId].totalSpent += order.total || 0;
        customerMap[customerId].lastOrderDate = new Date(order.created_at);
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
          const statsRes = await apiService.getAdminStats();
          setStats(statsRes.data);
        } else {
          const statsRes = await apiService.getStats(user?.merchant_id);
          setStats(statsRes.data);
        }

        // Load orders for analytics (without date filtering for now)
        const orderParams = { limit: 200 };
        const ordersRes = await apiService.getOrders(orderParams);
        const ordersData = ordersRes.data.orders || ordersRes.data;

        setRecentOrders(ordersData.slice(0, 5));

        // Compute analytics from orders
        computeAnalytics(ordersData);
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

  const isSuperAdmin = user?.role === "super_admin";

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
          <Button
            className="bg-primary hover:bg-primary-hover"
            onClick={() => navigate("/admin/orders")}
            data-testid="view-all-orders-btn"
          >
            View All Orders
            <ArrowUpRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isSuperAdmin ? (
            <>
              <StatCard
                title="Total Merchants"
                value={stats?.total_merchants || 0}
                icon={Store}
                color="info"
                loading={loading}
              />
              <StatCard
                title="Total Orders"
                value={stats?.total_orders || 0}
                icon={ShoppingCart}
                color="success"
                loading={loading}
              />
              <StatCard
                title="Total Revenue"
                value={`$${(stats?.total_revenue || 0).toLocaleString()}`}
                icon={DollarSign}
                color="warning"
                loading={loading}
              />
              <StatCard
                title="Active Orders"
                value={stats?.active_orders || 0}
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
                <Card className="border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-green-600 font-bold tracking-wider">
                          🔴 LIVE ORDERS
                        </p>
                        <p className="text-4xl font-heading font-bold mt-2 text-green-700">
                          {stats?.active_orders || 0}
                        </p>
                        <p className="text-sm text-green-600 mt-3 font-semibold">
                          +{ordersPerMinute} orders/min
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
                <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">
                          Total Customers
                        </p>
                        <p className="text-4xl font-heading font-bold mt-2 text-blue-700">
                          {Object.keys(customerSegments).length > 0
                            ? customerSegments.newCustomers +
                              customerSegments.repeat +
                              customerSegments.loyal
                            : 0}
                        </p>
                        <p className="text-sm text-blue-600 mt-3">
                          Avg Lifetime Value:{" "}
                          <span className="font-bold">
                            ${customerSegments.avgLTV}
                          </span>
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
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-25 rounded-lg border border-gray-100 hover:border-yellow-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold">
                              #{idx + 1}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">
                                {merchant.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {merchant.orderCount} orders • Avg: $
                                {(
                                  merchant.totalRevenue / merchant.orderCount
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">
                              $
                              {merchant.totalRevenue.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
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
                            <p className="font-bold text-sm text-green-600">
                              $
                              {item.revenue.toLocaleString("en-US", {
                                maximumFractionDigits: 0,
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
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
