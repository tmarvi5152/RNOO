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
import { getOrderHandoffCopy } from "../../lib/orderHandoff";
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

const DISPLAY_STEPS = [
  { label: "Received", statuses: ["pending", "confirmed"] },
  { label: "Preparing", statuses: ["preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Delivered", statuses: ["delivered"] },
];

const HorizontalTracker = ({ status }) => {
  const activeIdx = React.useMemo(() => {
    for (let i = 0; i < DISPLAY_STEPS.length; i++) {
      if (DISPLAY_STEPS[i].statuses.includes(status)) return i;
    }
    return 0;
  }, [status]);

  return (
    <div className="flex items-center w-full mb-6 px-1">
      {DISPLAY_STEPS.map((step, idx) => {
        const completed = idx < activeIdx;
        const current = idx === activeIdx;
        const isLast = idx === DISPLAY_STEPS.length - 1;
        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  completed ? "" : current ? "ring-4" : ""
                }`}
                style={
                  completed
                    ? {
                        backgroundColor: "var(--theme-app-accent)",
                        borderColor: "var(--theme-app-accent)",
                      }
                    : current
                      ? {
                          backgroundColor: "var(--theme-app-bg)",
                          borderColor: "var(--theme-app-accent)",
                          boxShadow: "0 0 0 4px var(--theme-app-focus-ring)",
                        }
                      : {
                          backgroundColor:
                            "color-mix(in srgb, var(--theme-app-bg) 72%, transparent)",
                          borderColor: "var(--theme-app-border)",
                        }
                }
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                  current
                    ? "consumer-theme-accent"
                    : completed
                      ? ""
                      : "consumer-theme-muted"
                }`}
                style={
                  completed && !current
                    ? { color: "var(--theme-app-text)" }
                    : undefined
                }
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="flex-1 h-0.5 mx-1 mb-5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--theme-app-border)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: "var(--theme-app-accent)" }}
                  initial={{ width: 0 }}
                  animate={{ width: completed ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const trackingMerchantId = order?.merchant_id;

  // WebSocket connection for real-time updates
  const { isConnected } = useOrderWebSocket({
    merchantId: trackingMerchantId,
    onOrderUpdate: (updatedOrder) => {
      if (updatedOrder && String(updatedOrder.id) === String(orderId)) {
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
        const res = await apiService.getOrderPublic(orderId, {
          _ts: Date.now(),
        });
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
      <div className="min-h-screen consumer-theme-shell">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen consumer-theme-shell flex items-center justify-center p-4">
        <Card className="max-w-md w-full consumer-theme-panel">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 consumer-theme-accent mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="consumer-theme-muted mb-6">
              {error || "We couldn't find this order."}
            </p>
            <Button
              onClick={() => navigate("/")}
              className="consumer-theme-button"
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
  const handoff = getOrderHandoffCopy({
    deliveryType: order.delivery_type,
    customerName: order.customer?.name,
    customerPhone: order.customer?.phone,
  });

  return (
    <div className="min-h-screen consumer-theme-shell">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 consumer-theme-icon-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Track Order</h1>
              <p className="text-sm mb-2">{handoff.title}</p>
              <div className="flex items-center gap-2 consumer-theme-muted">
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
              className="consumer-theme-button-secondary"
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
            <Card className="consumer-theme-panel">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order Status</span>
                  {isCancelled ? (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500">
                      Cancelled
                    </Badge>
                  ) : (
                    <Badge className="consumer-theme-accent-soft border">
                      {getStatusLabel(order.status)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isCancelled && <HorizontalTracker status={order.status} />}

                {!isCancelled && estimatedTime && (
                  <div className="mb-6 p-4 consumer-theme-accent-soft border rounded-xl">
                    <div className="flex items-center gap-2 consumer-theme-accent">
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
                                  ? "consumer-theme-accent-bg"
                                  : "consumer-theme-button-secondary consumer-theme-muted"
                              }`}
                              animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                              transition={{ repeat: Infinity, duration: 2 }}
                            >
                              <Icon className="w-6 h-6" />
                            </motion.div>
                            {index < statusSteps.length - 1 && (
                              <div
                                className={`absolute left-1/2 top-12 w-0.5 h-8 -ml-px transition-all ${
                                  isCompleted ? "" : ""
                                }`}
                                style={{
                                  backgroundColor: isCompleted
                                    ? "var(--theme-app-accent)"
                                    : "var(--theme-app-border)",
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 pt-2">
                            <h3
                              className={`font-semibold ${
                                isCompleted ? "" : "consumer-theme-muted"
                              }`}
                            >
                              {step.label}
                            </h3>
                            <p className="text-sm consumer-theme-muted">
                              {step.description}
                            </p>
                            {isCurrent && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-1 text-xs consumer-theme-accent font-medium"
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
            <Card className="consumer-theme-panel">
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 consumer-theme-panel-strong rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.quantity}x</span>
                          <span>{item.name}</span>
                        </div>
                        {item.modifiers?.length > 0 && (
                          <div className="mt-1 text-sm consumer-theme-muted">
                            {item.modifiers.map((m) => m.name).join(", ")}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="mt-1 text-xs consumer-theme-muted italic">
                            Note: {item.special_instructions}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold">
                        $
                        {(
                          item.total ?? (item.unit_price ?? 0) * item.quantity
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div
                  className="mt-4 pt-4 border-t space-y-2"
                  style={{ borderColor: "var(--theme-app-border)" }}
                >
                  <div className="flex justify-between consumer-theme-muted">
                    <span>Subtotal</span>
                    <span>${(order.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between consumer-theme-muted">
                    <span>Tax</span>
                    <span>${(order.tax || 0).toFixed(2)}</span>
                  </div>
                  {order.tip > 0 && (
                    <div className="flex justify-between consumer-theme-muted">
                      <span>Tip</span>
                      <span>${(order.tip || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div
                    className="flex justify-between text-lg font-bold pt-2 border-t"
                    style={{ borderColor: "var(--theme-app-border)" }}
                  >
                    <span>Total</span>
                    <span className="consumer-theme-accent">
                      ${(order.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Delivery Info */}
            <Card className="consumer-theme-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                      <MapPin className="w-4 h-4 consumer-theme-muted mt-1" />
                      <div className="text-sm">
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
                    <Clock className="w-4 h-4 consumer-theme-muted mt-1" />
                    <div className="text-sm">
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
            <Card className="consumer-theme-panel">
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>{order.customer?.name || "Guest"}</div>
                {order.customer?.phone && (
                  <div className="flex items-center gap-2 text-sm consumer-theme-muted">
                    <Phone className="w-4 h-4" />
                    {order.customer.phone}
                  </div>
                )}
                {order.customer?.email && (
                  <div className="flex items-center gap-2 text-sm consumer-theme-muted">
                    <Mail className="w-4 h-4" />
                    {order.customer.email}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card className="consumer-theme-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="consumer-theme-muted">Method</span>
                  <span className="capitalize">
                    {order.payment?.method || "Card"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="consumer-theme-muted">Status</span>
                  <Badge className="bg-green-500/20 text-green-400">Paid</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {order.notes && (
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle>Special Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{order.notes}</p>
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
