import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { AdminLayout } from "../../layouts/Layout";
import { useAuth, apiService, api } from "../../context/AppContext";
import { Card, CardContent } from "../../components/ui/card";
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
} from "../../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Truck,
  Wifi,
  WifiOff,
  Send,
  Loader2,
  Activity,
  Download,
} from "lucide-react";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle,
  },
  preparing: {
    label: "Preparing",
    color: "bg-purple-100 text-purple-800",
    icon: ChefHat,
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  delivered: {
    label: "Delivered",
    color: "bg-gray-100 text-gray-800",
    icon: Truck,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

const OrdersPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [posStatusFilter, setPosStatusFilter] = useState("all");
  const [errorStatusFilter, setErrorStatusFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all"); // all, has_discount, no_discount
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // all, delivery_only, pickup_only
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [submittingToShepherd, setSubmittingToShepherd] = useState(null);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [newOrderIds, setNewOrderIds] = useState(new Set());

  // Read query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("discount")) {
      setDiscountFilter(params.get("discount"));
    }
    if (params.get("delivery")) {
      setDeliveryFilter(params.get("delivery"));
    }
  }, [location.search]);

  // Handle new order from WebSocket
  const handleNewOrder = useCallback((order) => {
    setOrders((prev) => {
      // Check if order already exists
      if (prev.find((o) => o.id === order.id)) return prev;
      // Add to beginning of list
      return [order, ...prev];
    });
    // Highlight new order
    setNewOrderIds((prev) => new Set([...prev, order.id]));
    // Show toast notification
    toast.success(`New order #${order.order_number} received!`, {
      description: `${order.customer?.name} - $${order.total?.toFixed(2)}`,
      duration: 5000,
    });
  }, []);

  // Handle order update from WebSocket
  const handleOrderUpdate = useCallback((order, eventType) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    // Update selected order if it's the one being viewed
    setSelectedOrder((prev) => {
      if (prev && prev.id === order.id) return order;
      return prev;
    });
    // Show toast for status changes
    if (eventType !== "new_order") {
      toast.info(`Order #${order.order_number} updated`, {
        description: `Status: ${statusConfig[order.status]?.label || order.status}`,
      });
    }
  }, []);

  // WebSocket connection
  const { isConnected } = useOrderWebSocket({
    isAdmin: ["super_admin", "reseller"].includes(user?.role),
    merchantId: user?.role === "merchant" ? user?.merchant_id : undefined,
    onNewOrder: handleNewOrder,
    onOrderUpdate: handleOrderUpdate,
  });

  // Clear new order highlight after 10 seconds
  useEffect(() => {
    if (newOrderIds.size > 0) {
      const timer = setTimeout(() => {
        setNewOrderIds(new Set());
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  const loadOrders = useCallback(
    async (page = 1, resetPagination = false) => {
      try {
        setLoading(true);
        setError(null);
        const params = {
          limit: pageSize,
          skip: (page - 1) * pageSize,
        };
        if (statusFilter !== "all") params.order_status = statusFilter;

        const res = await apiService.getOrders(params);

        // Handle new pagination response format
        let ordersData = res.data;
        let paginationData = null;

        if (res.data.orders && res.data.pagination) {
          // New paginated response
          ordersData = res.data.orders;
          paginationData = res.data.pagination;
        } else {
          // Fallback for old response format
          ordersData = res.data;
        }

        setOrders(ordersData);
        setPagination(paginationData);
        if (resetPagination) {
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Failed to load orders:", err);
        setError(err.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
    },
    [pageSize, statusFilter],
  );

  useEffect(() => {
    loadOrders(1, true); // Reset to page 1 when filters change
  }, [loadOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      setUpdating(true);
      await apiService.updateOrderStatus(orderId, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
      // Note: WebSocket will handle the UI update
    } catch {
      toast.error("Failed to update status");
      loadOrders(); // Fallback reload on error
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmitToShepherd = async (orderId) => {
    try {
      setSubmittingToShepherd(orderId);
      await api.post(`/orders/${orderId}/submit-to-shepherd`);
      toast.success("Order submitted to Shepherd/POS successfully");
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit to Shepherd");
    } finally {
      setSubmittingToShepherd(null);
    }
  };

  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);

  // Fetch sync status info
  const loadSyncInfo = useCallback(async () => {
    if (!["super_admin", "reseller"].includes(user?.role)) return;
    try {
      const res = await api.get("/orders/sync-status-info");
      setSyncInfo(res.data);
    } catch (err) {
      console.error("Failed to load sync info:", err);
    }
  }, [user?.role]);

  useEffect(() => {
    loadSyncInfo();
    // Refresh sync info every 30 seconds
    const interval = setInterval(loadSyncInfo, 30000);
    return () => clearInterval(interval);
  }, [loadSyncInfo]);

  const handleSyncAllStatuses = async () => {
    try {
      setSyncingStatuses(true);
      const res = await api.post("/orders/sync-all-statuses");
      const { synced_count, failed_count } = res.data;
      if (synced_count > 0) {
        toast.success(`Synced ${synced_count} order statuses from POS`);
      } else {
        toast.info("No pending orders to sync");
      }
      if (failed_count > 0) {
        toast.warning(`${failed_count} orders failed to sync`);
      }
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to sync statuses");
    } finally {
      setSyncingStatuses(false);
    }
  };

  const handleSyncOrderStatus = async (orderId) => {
    try {
      const res = await api.post(`/orders/${orderId}/sync-status`);
      if (res.data.status_changed) {
        toast.success(`Order status updated to ${res.data.internal_status}`);
      } else {
        toast.info(`Order status unchanged: ${res.data.shepherd_status}`);
      }
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to sync order status");
    }
  };

  const handleExportToCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    try {
      // Prepare CSV headers
      const headers = [
        "Order #",
        "Customer",
        "Email",
        "Phone",
        "Total",
        "Status",
        "POS Status",
        "Date",
        "Items",
      ];

      // Prepare CSV rows
      const rows = filteredOrders.map((order) => [
        order.order_number,
        order.customer?.name || "Unknown",
        order.customer?.email || "N/A",
        order.customer?.phone || "N/A",
        `$${order.total?.toFixed(2) || "0.00"}`,
        order.status || "Unknown",
        order.shepherd_submitted
          ? "Submitted"
          : order.shepherd_error
            ? "Failed"
            : "Pending",
        new Date(order.created_at).toLocaleString(),
        order.order_items?.length || 0,
      ]);

      // Create CSV content
      const csvContent = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download CSV
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent),
      );
      element.setAttribute(
        "download",
        `orders_${new Date().toISOString().split("T")[0]}.csv`,
      );
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success(`Exported ${filteredOrders.length} order(s) to CSV`);
    } catch (err) {
      console.error("Failed to export orders:", err);
      toast.error("Failed to export orders");
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          order.order_number?.toString().includes(term) ||
          order.customer?.name?.toLowerCase().includes(term) ||
          order.customer?.email?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      // POS status filter
      if (posStatusFilter !== "all") {
        if (posStatusFilter === "submitted" && !order.shepherd_submitted)
          return false;
        if (posStatusFilter === "failed" && !order.shepherd_error) return false;
        if (
          posStatusFilter === "pending" &&
          (order.shepherd_submitted || order.shepherd_error)
        )
          return false;
      }
      // Error status filter
      if (errorStatusFilter === "with-errors" && !order.shepherd_error)
        return false;
      if (errorStatusFilter === "without-errors" && order.shepherd_error)
        return false;
      // Discount filter
      if (discountFilter === "has_discount" && !order.discount_amount)
        return false;
      if (discountFilter === "no_discount" && order.discount_amount)
        return false;
      // Delivery filter
      if (deliveryFilter === "delivery_only" && order.delivery_type !== "DELIVERY" && order.delivery_type !== "delivery")
        return false;
      if (deliveryFilter === "pickup_only" && (order.delivery_type === "DELIVERY" || order.delivery_type === "delivery"))
        return false;
      // Date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (new Date(order.created_at) < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(order.created_at) > toDate) return false;
      }
      return true;
    });
  }, [
    orders,
    searchTerm,
    posStatusFilter,
    errorStatusFilter,
    discountFilter,
    deliveryFilter,
    dateFrom,
    dateTo,
  ]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <TooltipProvider>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900">
                Orders
              </h1>
              <p className="text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                Manage and track all orders
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <Wifi className="w-3 h-3" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
                {/* Auto-sync status indicator */}
                {syncInfo &&
                  syncInfo.sync_enabled &&
                  syncInfo.background_task_running && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full cursor-help"
                          data-testid="auto-sync-indicator"
                        >
                          <Activity className="w-3 h-3 animate-pulse" />
                          Auto-Sync
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          POS statuses sync every{" "}
                          {syncInfo.sync_interval_seconds}s
                        </p>
                        <p className="text-muted-foreground">
                          {syncInfo.orders_pending_sync} orders being monitored
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSyncAllStatuses}
                disabled={syncingStatuses}
                data-testid="sync-statuses-btn"
                title="Manually sync order statuses from POS"
              >
                {syncingStatuses ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync from POS
              </Button>
              <Button
                variant="outline"
                onClick={loadOrders}
                disabled={loading}
                data-testid="refresh-orders-btn"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleExportToCSV}
                disabled={loading || filteredOrders.length === 0}
                data-testid="export-orders-btn"
                title="Export filtered orders to CSV"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* First row: Search and Order Status */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by order #, name, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="search-orders-input"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger
                      className="w-full sm:w-48"
                      data-testid="status-filter-select"
                    >
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Second row: POS Status and Error Status */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select
                    value={posStatusFilter}
                    onValueChange={setPosStatusFilter}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="POS Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All POS Statuses</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={errorStatusFilter}
                    onValueChange={setErrorStatusFilter}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Error Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Errors</SelectItem>
                      <SelectItem value="with-errors">With Errors</SelectItem>
                      <SelectItem value="without-errors">
                        Without Errors
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Discount & Delivery Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={discountFilter} onValueChange={setDiscountFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Discount Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="has_discount">With Discount</SelectItem>
                      <SelectItem value="no_discount">No Discount</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Delivery Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Delivery Types</SelectItem>
                      <SelectItem value="delivery_only">Delivery Orders</SelectItem>
                      <SelectItem value="pickup_only">Pickup Orders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Third row: Date Range */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="From date"
                    className="w-full sm:w-48"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="To date"
                    className="w-full sm:w-48"
                  />
                  {(searchTerm ||
                    statusFilter !== "all" ||
                    posStatusFilter !== "all" ||
                    errorStatusFilter !== "all" ||
                    dateFrom ||
                    dateTo) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("all");
                        setPosStatusFilter("all");
                        setErrorStatusFilter("all");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="w-full sm:w-auto"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>

              {/* Active filters summary */}
              {(searchTerm ||
                statusFilter !== "all" ||
                posStatusFilter !== "all" ||
                errorStatusFilter !== "all" ||
                dateFrom ||
                dateTo) && (
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  <span className="font-medium">Active filters:</span>
                  {searchTerm && (
                    <Badge className="ml-2">Search: {searchTerm}</Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge className="ml-2">Status: {statusFilter}</Badge>
                  )}
                  {posStatusFilter !== "all" && (
                    <Badge className="ml-2">POS: {posStatusFilter}</Badge>
                  )}
                  {errorStatusFilter !== "all" && (
                    <Badge className="ml-2">Errors: {errorStatusFilter}</Badge>
                  )}
                  {dateFrom && (
                    <Badge className="ml-2">
                      From: {new Date(dateFrom).toLocaleDateString()}
                    </Badge>
                  )}
                  {dateTo && (
                    <Badge className="ml-2">
                      To: {new Date(dateTo).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error State */}
          {error && !loading && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-900">
                        Failed to load orders
                      </h3>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => loadOrders(currentPage)}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-20" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>POS</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        // Skeleton loading rows
                        Array.from({ length: 5 }, (_, i) => (
                          <TableRow key={`skeleton-${i}`}>
                            <TableCell>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-12" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-6 w-16 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-6 w-16 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-8 w-20" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <AnimatePresence>
                          {filteredOrders.map((order) => {
                            const status =
                              statusConfig[order.status] ||
                              statusConfig.pending;
                            const isNew = newOrderIds.has(order.id);
                            return (
                              <motion.tr
                                key={order.id}
                                initial={
                                  isNew
                                    ? { backgroundColor: "rgb(220, 252, 231)" }
                                    : false
                                }
                                animate={{ backgroundColor: "transparent" }}
                                transition={{ duration: 3 }}
                                className="border-b"
                                data-testid={`order-row-${order.id}`}
                              >
                                <TableCell className="font-bold">
                                  #{order.order_number}
                                  {isNew && (
                                    <Badge className="ml-2 bg-green-500 text-white text-xs">
                                      NEW
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {order.customer?.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {order.customer?.email}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {order.delivery_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {order.items?.length || 0} items
                                </TableCell>
                                <TableCell className="font-semibold">
                                  ${order.total?.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge className={status.color}>
                                    {status.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {order.shepherd_submitted ? (
                                    <Badge className="bg-green-100 text-green-800">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Sent
                                    </Badge>
                                  ) : order.shepherd_error ? (
                                    <Badge className="bg-red-100 text-red-800">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Failed
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-gray-400"
                                    >
                                      Pending
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-gray-500">
                                  {formatDate(order.created_at)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedOrder(order)}
                                      data-testid={`view-order-btn-${order.id}`}
                                    >
                                      <Eye className="w-4 h-4 mr-1" />
                                      View
                                    </Button>
                                  </div>
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      )}
                      {!loading && filteredOrders.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center py-8 text-gray-500"
                          >
                            No orders found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination && pagination.total > pageSize && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * pageSize + 1} to{" "}
                      {Math.min(currentPage * pageSize, pagination.total)} of{" "}
                      {pagination.total} orders
                    </div>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => setPageSize(parseInt(value))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentPage((prev) => prev - 1);
                        loadOrders(currentPage - 1);
                      }}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from(
                        {
                          length: Math.min(
                            5,
                            Math.ceil(pagination.total / pageSize),
                          ),
                        },
                        (_, i) => {
                          const pageNum =
                            Math.max(
                              1,
                              Math.min(
                                Math.ceil(pagination.total / pageSize) - 4,
                                currentPage - 2,
                              ),
                            ) + i;
                          if (pageNum > Math.ceil(pagination.total / pageSize))
                            return null;
                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pageNum === currentPage ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                setCurrentPage(pageNum);
                                loadOrders(pageNum);
                              }}
                            >
                              {pageNum}
                            </Button>
                          );
                        },
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentPage((prev) => prev - 1 + 2);
                        loadOrders(currentPage + 1);
                      }}
                      disabled={!pagination.has_more}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Detail Modal */}
          <Dialog
            open={!!selectedOrder}
            onOpenChange={() => setSelectedOrder(null)}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              {selectedOrder && (
                <>
                  <DialogHeader>
                    <DialogTitle className="font-heading flex items-center gap-3">
                      Order #{selectedOrder.order_number}
                      <Badge
                        className={statusConfig[selectedOrder.status]?.color}
                      >
                        {statusConfig[selectedOrder.status]?.label}
                      </Badge>
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-500 mb-1">
                          Customer
                        </h4>
                        <p className="font-medium">
                          {selectedOrder.customer?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedOrder.customer?.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedOrder.customer?.phone}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-gray-500 mb-1">
                          Delivery
                        </h4>
                        <p className="font-medium">
                          {selectedOrder.delivery_type}
                        </p>
                        {selectedOrder.customer?.address_line1 && (
                          <p className="text-sm text-gray-500">
                            {selectedOrder.customer.address_line1},{" "}
                            {selectedOrder.customer.city}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* POS/Shepherd Status */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-sm text-gray-500 mb-2">
                        POS Integration
                      </h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {selectedOrder.shepherd_submitted ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-600" />
                              <div>
                                <span className="text-green-700">
                                  Sent to POS
                                </span>
                                <span className="text-xs text-gray-500 block">
                                  {selectedOrder.shepherd_submitted_at &&
                                    `at ${formatDate(selectedOrder.shepherd_submitted_at)}`}
                                </span>
                                {selectedOrder.shepherd_status && (
                                  <span className="text-xs text-blue-600 block">
                                    POS Status: {selectedOrder.shepherd_status}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : selectedOrder.shepherd_error ? (
                            <>
                              <XCircle className="w-5 h-5 text-red-600" />
                              <div>
                                <span className="text-red-700">
                                  Failed to send
                                </span>
                                <p className="text-xs text-red-500">
                                  {selectedOrder.shepherd_error}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <Clock className="w-5 h-5 text-yellow-600" />
                              <span className="text-yellow-700">
                                Pending submission
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedOrder.shepherd_submitted &&
                            selectedOrder.shepherd_order_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSyncOrderStatus(selectedOrder.id)
                                }
                                title="Sync status from POS"
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Sync
                              </Button>
                            )}
                          {(!selectedOrder.shepherd_submitted ||
                            selectedOrder.shepherd_error) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleSubmitToShepherd(selectedOrder.id)
                              }
                              disabled={
                                submittingToShepherd === selectedOrder.id
                              }
                            >
                              {submittingToShepherd === selectedOrder.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-1" />
                              )}
                              {selectedOrder.shepherd_error
                                ? "Retry"
                                : "Send to POS"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-500 mb-2">
                        Items
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        {selectedOrder.items?.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-start"
                          >
                            <div>
                              <p className="font-medium">
                                {item.quantity}x {item.name}
                              </p>
                              {item.modifiers?.length > 0 && (
                                <p className="text-sm text-gray-500">
                                  {item.modifiers
                                    .map((m) => m.option_name)
                                    .join(", ")}
                                </p>
                              )}
                              {item.special_instructions && (
                                <p className="text-xs text-gray-400 italic">
                                  Note: {item.special_instructions}
                                </p>
                              )}
                            </div>
                            <span className="font-medium">
                              $
                              {(
                                (item.unit_price +
                                  (item.modifiers?.reduce(
                                    (s, m) => s + m.price,
                                    0,
                                  ) || 0)) *
                                item.quantity
                              ).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span>${selectedOrder.subtotal?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tax</span>
                        <span>${selectedOrder.tax?.toFixed(2)}</span>
                      </div>
                      {selectedOrder.tip > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tip</span>
                          <span>${selectedOrder.tip?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>${selectedOrder.total?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Update Status */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-500 mb-2">
                        Update Status
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <Button
                            key={key}
                            variant={
                              selectedOrder.status === key
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            disabled={updating || selectedOrder.status === key}
                            onClick={() =>
                              handleStatusUpdate(selectedOrder.id, key)
                            }
                            className={
                              selectedOrder.status === key ? "bg-primary" : ""
                            }
                          >
                            <config.icon className="w-4 h-4 mr-1" />
                            {config.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>
      </TooltipProvider>
    </AdminLayout>
  );
};

export default OrdersPage;
