import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiService } from "../../context/AppContext";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle,
  Clock,
  ChefHat,
  Package,
  Truck,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Store,
  Calendar,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const statusSteps = [
  {
    key: "pending",
    label: "Order Received",
    icon: CheckCircle,
    description: "Your order has been received",
  },
  {
    key: "confirmed",
    label: "Confirmed",
    icon: Clock,
    description: "Restaurant confirmed your order",
  },
  {
    key: "preparing",
    label: "Preparing",
    icon: ChefHat,
    description: "Your food is being prepared",
  },
  {
    key: "ready",
    label: "Ready",
    icon: Package,
    description: "Order is ready",
  },
  {
    key: "delivered",
    label: "Completed",
    icon: Truck,
    description: "Order completed",
  },
];

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // WebSocket connection for real-time updates
  const { isConnected } = useOrderWebSocket({
    onOrderUpdate: (updatedOrder) => {
      if (String(updatedOrder.id) === String(orderId)) {
        setOrder(updatedOrder);
        toast.success(
          `Order status updated: ${getStatusLabel(updatedOrder.status)}`,
        );
      }
    },
  });

  const loadOrder = useCallback(
    async (options = {}) => {
      const { silent = false, suppressError = false } = options;
      try {
        if (!silent) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        if (!silent) {
          setError(null);
        }
        const res = await apiService.getOrderPublic(orderId);
        setOrder(res.data);
      } catch (err) {
        console.error("Failed to load order:", err);
        if (!suppressError) {
          setError("Order not found or access denied");
          toast.error("Failed to load order details");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [orderId],
  );

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadOrder({ silent: true, suppressError: true });
    }, 10000);
    return () => clearInterval(intervalId);
  }, [loadOrder]);

  const getStatusLabel = (status) => {
    return statusSteps.find((s) => s.key === status)?.label || status;
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    if (order.status === "cancelled") return -1;
    return statusSteps.findIndex((s) => s.key === order.status);
  };

  const getEstimatedTime = () => {
    if (!order) return null;
    const status = order.status;

    if (status === "delivered" || status === "cancelled") return null;

    const estimates = {
      pending: "2-5 minutes",
      confirmed: "15-25 minutes",
      preparing: "10-15 minutes",
      ready:
        order.delivery_type === "delivery"
          ? "10-20 minutes"
          : "Ready for pickup",
    };

    return estimates[status] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-zinc-800/50 border-white/10">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Order Not Found
            </h2>
            <p className="text-zinc-400 mb-6">
              {error || "We couldn't find this order."}
            </p>
            <Button
              onClick={() => navigate("/")}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const estimatedTime = getEstimatedTime();
  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white hover:text-orange-400 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Order #{order.order_number}
              </h1>
              <div className="flex items-center gap-2 text-zinc-400">
                <Calendar className="w-4 h-4" />
                <span>{new Date(order.created_at).toLocaleString()}</span>
                {isConnected && (
                  <Badge
                    variant="outline"
                    className="ml-2 border-green-500 text-green-400"
                  >
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                    Live
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadOrder({ silent: true })}
              className="text-white border-white/20"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Progress */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <Card className="bg-zinc-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Order Status</span>
                  {isCancelled ? (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500">
                      Cancelled
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500">
                      {getStatusLabel(order.status)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isCancelled && estimatedTime && (
                  <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-orange-400">
                      <Clock className="w-5 h-5" />
                      <span className="font-semibold">
                        Estimated: {estimatedTime}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress Steps */}
                {!isCancelled && (
                  <div className="space-y-4">
                    {statusSteps.map((step, index) => {
                      const isCompleted = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      const Icon = step.icon;

                      return (
                        <motion.div
                          key={step.key}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-4"
                        >
                          <div className="relative">
                            <motion.div
                              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                isCompleted
                                  ? "bg-orange-500 text-white"
                                  : "bg-zinc-700 text-zinc-400"
                              }`}
                              animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ repeat: Infinity, duration: 2 }}
                            >
                              <Icon className="w-6 h-6" />
                            </motion.div>
                            {index < statusSteps.length - 1 && (
                              <div
                                className={`absolute left-1/2 top-12 w-0.5 h-8 -ml-px transition-all ${
                                  isCompleted ? "bg-orange-500" : "bg-zinc-700"
                                }`}
                              />
                            )}
                          </div>
                          <div className="flex-1 pt-2">
                            <h3
                              className={`font-semibold ${isCompleted ? "text-white" : "text-zinc-400"}`}
                            >
                              {step.label}
                            </h3>
                            <p className="text-sm text-zinc-500">
                              {step.description}
                            </p>
                            {isCurrent && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-1 text-xs text-orange-400 font-medium"
                              >
                                In progress...
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card className="bg-zinc-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 bg-zinc-700/30 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {item.quantity}x
                          </span>
                          <span className="text-white">{item.name}</span>
                        </div>
                        {item.modifiers?.length > 0 && (
                          <div className="mt-1 text-sm text-zinc-400">
                            {item.modifiers.map((m) => m.name).join(", ")}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="mt-1 text-xs text-zinc-500 italic">
                            Note: {item.special_instructions}
                          </div>
                        )}
                      </div>
                      <span className="text-white font-semibold">
                        ${item.total.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>${order.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Tax</span>
                    <span>${order.tax.toFixed(2)}</span>
                  </div>
                  {order.tip > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Tip</span>
                      <span>${order.tip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-orange-400">
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Delivery Info */}
            <Card className="bg-zinc-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  {order.delivery_type === "delivery" ? (
                    <>
                      <Truck className="w-5 h-5" />
                      Delivery
                    </>
                  ) : (
                    <>
                      <Store className="w-5 h-5" />
                      Pickup
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.delivery_type === "delivery" &&
                  order.customer?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-zinc-400 mt-1" />
                      <div className="text-sm text-zinc-300">
                        <p>{order.customer.address.street}</p>
                        {order.customer.address.apt && (
                          <p>Apt {order.customer.address.apt}</p>
                        )}
                        <p>
                          {order.customer.address.city},{" "}
                          {order.customer.address.state}{" "}
                          {order.customer.address.zip}
                        </p>
                      </div>
                    </div>
                  )}

                {order.order_timing !== "ASAP" && order.scheduled_time && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-zinc-400 mt-1" />
                    <div className="text-sm text-zinc-300">
                      <p>Scheduled for</p>
                      <p className="font-medium">
                        {order.scheduled_date} at {order.scheduled_time}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card className="bg-zinc-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-white">
                  {order.customer?.name || "Guest"}
                </div>
                {order.customer?.phone && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Phone className="w-4 h-4" />
                    {order.customer.phone}
                  </div>
                )}
                {order.customer?.email && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Mail className="w-4 h-4" />
                    {order.customer.email}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card className="bg-zinc-800/50 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Method</span>
                  <span className="text-white capitalize">
                    {order.payment?.method || "Card"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Status</span>
                  <Badge className="bg-green-500/20 text-green-400">Paid</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {order.notes && (
              <Card className="bg-zinc-800/50 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">
                    Special Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-zinc-300 text-sm">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
