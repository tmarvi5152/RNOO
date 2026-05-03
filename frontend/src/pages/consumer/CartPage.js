import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ConsumerLayout } from "../../layouts/Layout";
import { apiService, useCart } from "../../context/AppContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Truck,
  ShoppingBag,
  CreditCard,
  Loader2,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";

const CartPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getItemTotal,
    subtotal,
    tax,
    total,
    itemCount,
    merchantId,
  } = useCart();

  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  const [deliveryType, setDeliveryType] = useState("TAKEOUT");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [notes, setNotes] = useState("");

  // Order timing state
  const [orderTiming, setOrderTiming] = useState("ASAP");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Customer info
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    city: "",
    state: "",
    zip_code: "",
  });

  // Generate date options for the next 7 days
  const getDateOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const label =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
      options.push({ value: dateStr, label });
    }
    return options;
  };

  // Generate time options (every 15 minutes from now to closing)
  const getTimeOptions = () => {
    const options = [];
    const now = new Date();
    const isToday = scheduledDate === new Date().toISOString().split("T")[0];

    // Start from next 15-minute slot if today
    let startHour = isToday ? now.getHours() : 9;
    let startMinute = isToday ? Math.ceil(now.getMinutes() / 15) * 15 : 0;

    if (startMinute >= 60) {
      startHour++;
      startMinute = 0;
    }

    // Add 30 minutes buffer for preparation
    if (isToday) {
      startMinute += 30;
      if (startMinute >= 60) {
        startHour++;
        startMinute -= 60;
      }
    }

    for (let h = startHour; h < 22; h++) {
      for (let m = h === startHour ? startMinute : 0; m < 60; m += 15) {
        const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const ampm = h >= 12 ? "PM" : "AM";
        const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const label = `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
        options.push({ value: timeStr, label });
      }
    }
    return options;
  };

  const loadMerchant = useCallback(async () => {
    try {
      const res = await apiService.getMerchantBySlug(slug);
      setMerchant(res.data);
    } catch (err) {
      console.error("Failed to load merchant:", err);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  const handleTipSelect = (amount) => {
    setTip(amount);
    setCustomTip("");
  };

  const handleCustomTip = (value) => {
    const numValue = parseFloat(value) || 0;
    setCustomTip(value);
    setTip(numValue);
  };

  const validateForm = () => {
    if (!customer.name.trim()) {
      toast.error("Please enter your name");
      return false;
    }
    if (!customer.email.trim() || !/\S+@\S+\.\S+/.test(customer.email)) {
      toast.error("Please enter a valid email");
      return false;
    }
    if (!customer.phone.trim()) {
      toast.error("Please enter your phone number");
      return false;
    }
    if (deliveryType === "DELIVERY") {
      if (
        !customer.address_line1.trim() ||
        !customer.city.trim() ||
        !customer.zip_code.trim()
      ) {
        toast.error("Please enter your full delivery address");
        return false;
      }
    }
    // Validate scheduled time for non-ASAP orders
    if (orderTiming !== "ASAP") {
      if (!scheduledDate) {
        toast.error("Please select a date");
        return false;
      }
      if (!scheduledTime) {
        toast.error("Please select a time");
        return false;
      }
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        merchant_id: merchantId,
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address_line1:
            deliveryType === "DELIVERY" ? customer.address_line1 : undefined,
          city: deliveryType === "DELIVERY" ? customer.city : undefined,
          state: deliveryType === "DELIVERY" ? customer.state : undefined,
          zip_code: deliveryType === "DELIVERY" ? customer.zip_code : undefined,
        },
        delivery_type: deliveryType,
        order_timing: orderTiming,
        scheduled_date: orderTiming !== "ASAP" ? scheduledDate : undefined,
        scheduled_time: orderTiming !== "ASAP" ? scheduledTime : undefined,
        items: items.map((item) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate_id: item.tax_rate_id || null,
          tax_rate_percent: item.tax_rate_percent ?? null,
          modifiers: item.modifiers || [],
          special_instructions: item.special_instructions || "",
          plu: item.plu,
          shepherd_pos_id: item.shepherd_pos_id,
        })),
        payment: {
          method: "mock_card",
          card_last_four: "4242",
          amount: total + tip,
          tip: tip,
        },
        notes: notes || undefined,
      };

      const res = await apiService.createOrder(orderData);
      setOrderDetails(res.data);
      setOrderPlaced(true);
      clearCart();
      toast.success("Order placed successfully!");
    } catch (err) {
      console.error("Failed to place order:", err);
      // Handle Pydantic validation errors which return detail as array
      const detail = err.response?.data?.detail;
      let errorMessage = "Failed to place order";
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        errorMessage =
          detail[0]?.msg || detail[0]?.message || "Validation error";
      }
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = merchant?.branding?.primary_color || "#7C3AED";
  const finalTotal = total + tip;

  // Order Success View
  if (orderPlaced && orderDetails) {
    return (
      <ConsumerLayout merchant={merchant}>
        <div className="min-h-screen consumer-theme-shell">
          <div className="max-w-2xl mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6"
                style={{ backgroundColor: primaryColor }}
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-heading font-bold mb-2">
                Order Confirmed!
              </h1>
              <p className="consumer-theme-muted mb-6">
                Thank you for your order. We&apos;ve received it and will start
                preparing it soon.
              </p>

              <Card className="text-left mb-6 consumer-theme-panel">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="consumer-theme-muted">Order Number</span>
                      <span className="font-bold text-xl">
                        #{orderDetails.order_number}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="consumer-theme-muted">Order Type</span>
                      <span className="font-medium">
                        {orderDetails.delivery_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="consumer-theme-muted">Total</span>
                      <span className="font-bold">
                        ${orderDetails.total.toFixed(2)}
                      </span>
                    </div>
                    <Separator />
                    <div>
                      <p className="consumer-theme-muted text-sm mb-2">Items</p>
                      {orderDetails.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-sm py-1"
                        >
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          <span>
                            ${(item.unit_price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/order/${slug}`)}
                >
                  Order More
                </Button>
                <Button
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => navigate("/")}
                >
                  Back to Home
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </ConsumerLayout>
    );
  }

  // Empty Cart View
  if (!loading && items.length === 0) {
    return (
      <ConsumerLayout merchant={merchant}>
        <div className="min-h-screen consumer-theme-shell">
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <div className="w-20 h-20 consumer-theme-panel rounded-full mx-auto flex items-center justify-center mb-6">
              <ShoppingBag className="w-10 h-10 consumer-theme-muted" />
            </div>
            <h1 className="text-2xl font-heading font-bold mb-2">
              Your cart is empty
            </h1>
            <p className="consumer-theme-muted mb-6">
              Looks like you haven&apos;t added anything to your cart yet.
            </p>
            <Button
              style={{ backgroundColor: primaryColor }}
              onClick={() => navigate(`/order/${slug}`)}
            >
              Browse Menu
            </Button>
          </div>
        </div>
      </ConsumerLayout>
    );
  }

  return (
    <ConsumerLayout merchant={merchant}>
      <div className="min-h-screen consumer-theme-shell">
        <div className="max-w-4xl mx-auto px-4 py-6 pb-32 lg:pb-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="mb-4 consumer-theme-icon-button"
            onClick={() => navigate(`/order/${slug}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Menu
          </Button>

          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-6">
            Your Cart
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items & Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cart Items */}
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">
                    Order Items ({itemCount})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
                    >
                      <img
                        src={
                          item.image_url ||
                          "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg"
                        }
                        alt={item.name}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.name}</h4>
                        {item.modifiers?.length > 0 && (
                          <p className="text-sm consumer-theme-muted">
                            {item.modifiers
                              .map((m) => m.option_name)
                              .join(", ")}
                          </p>
                        )}
                        {item.special_instructions && (
                          <p className="text-xs consumer-theme-muted italic mt-1">
                            &quot;{item.special_instructions}&quot;
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">
                              ${getItemTotal(item).toFixed(2)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-semantic-error hover:text-semantic-error"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Delivery Type */}
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">Order Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={deliveryType}
                    onValueChange={setDeliveryType}
                  >
                    <div className="flex gap-4">
                      <Label
                        htmlFor="takeout"
                        className={`flex-1 flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                          deliveryType === "TAKEOUT" ? "border-2" : ""
                        }`}
                        style={
                          deliveryType === "TAKEOUT"
                            ? { borderColor: primaryColor }
                            : {}
                        }
                      >
                        <RadioGroupItem value="TAKEOUT" id="takeout" />
                        <ShoppingBag className="w-5 h-5" />
                        <span className="font-medium">Pickup</span>
                      </Label>
                      <Label
                        htmlFor="delivery"
                        className={`flex-1 flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                          deliveryType === "DELIVERY" ? "border-2" : ""
                        }`}
                        style={
                          deliveryType === "DELIVERY"
                            ? { borderColor: primaryColor }
                            : {}
                        }
                      >
                        <RadioGroupItem value="DELIVERY" id="delivery" />
                        <Truck className="w-5 h-5" />
                        <span className="font-medium">Delivery</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Order Timing */}
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">
                    When do you want it?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={orderTiming}
                    onValueChange={(value) => {
                      setOrderTiming(value);
                      // Set default date for ADVANCE (today) and FUTURE (tomorrow)
                      if (value === "ADVANCE") {
                        setScheduledDate(
                          new Date().toISOString().split("T")[0],
                        );
                      } else if (value === "FUTURE") {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setScheduledDate(tomorrow.toISOString().split("T")[0]);
                      } else {
                        setScheduledDate("");
                        setScheduledTime("");
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Label
                        htmlFor="asap"
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                          orderTiming === "ASAP" ? "border-2" : ""
                        }`}
                        style={
                          orderTiming === "ASAP"
                            ? { borderColor: primaryColor }
                            : {}
                        }
                      >
                        <RadioGroupItem value="ASAP" id="asap" />
                        <Clock className="w-5 h-5" />
                        <div>
                          <span className="font-medium block">ASAP</span>
                          <span className="text-xs consumer-theme-muted">
                            As soon as possible
                          </span>
                        </div>
                      </Label>
                      <Label
                        htmlFor="advance"
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                          orderTiming === "ADVANCE" ? "border-2" : ""
                        }`}
                        style={
                          orderTiming === "ADVANCE"
                            ? { borderColor: primaryColor }
                            : {}
                        }
                      >
                        <RadioGroupItem value="ADVANCE" id="advance" />
                        <Clock className="w-5 h-5" />
                        <div>
                          <span className="font-medium block">Later Today</span>
                          <span className="text-xs consumer-theme-muted">
                            Schedule for today
                          </span>
                        </div>
                      </Label>
                      <Label
                        htmlFor="future"
                        className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                          orderTiming === "FUTURE" ? "border-2" : ""
                        }`}
                        style={
                          orderTiming === "FUTURE"
                            ? { borderColor: primaryColor }
                            : {}
                        }
                      >
                        <RadioGroupItem value="FUTURE" id="future" />
                        <Calendar className="w-5 h-5" />
                        <div>
                          <span className="font-medium block">Schedule</span>
                          <span className="text-xs consumer-theme-muted">
                            Pick a future date
                          </span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Date and Time Selection for non-ASAP orders */}
                  {orderTiming !== "ASAP" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <Label htmlFor="date" className="mb-2 block">
                          Date
                        </Label>
                        <select
                          id="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full h-10 px-3 py-2 border rounded-md consumer-theme-input text-sm"
                          data-testid="scheduled-date-select"
                        >
                          <option value="">Select date</option>
                          {getDateOptions().map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              disabled={
                                orderTiming === "ADVANCE" &&
                                opt.value !==
                                  new Date().toISOString().split("T")[0]
                              }
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="time" className="mb-2 block">
                          Time
                        </Label>
                        <select
                          id="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full h-10 px-3 py-2 border rounded-md consumer-theme-input text-sm"
                          disabled={!scheduledDate}
                          data-testid="scheduled-time-select"
                        >
                          <option value="">Select time</option>
                          {getTimeOptions().map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={customer.name}
                        onChange={(e) =>
                          setCustomer({ ...customer, name: e.target.value })
                        }
                        placeholder="John Doe"
                        data-testid="customer-name-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customer.phone}
                        onChange={(e) =>
                          setCustomer({ ...customer, phone: e.target.value })
                        }
                        placeholder="(555) 123-4567"
                        data-testid="customer-phone-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customer.email}
                      onChange={(e) =>
                        setCustomer({ ...customer, email: e.target.value })
                      }
                      placeholder="john@example.com"
                      data-testid="customer-email-input"
                    />
                  </div>

                  {deliveryType === "DELIVERY" && (
                    <>
                      <Separator />
                      <div>
                        <Label htmlFor="address">Delivery Address *</Label>
                        <Input
                          id="address"
                          value={customer.address_line1}
                          onChange={(e) =>
                            setCustomer({
                              ...customer,
                              address_line1: e.target.value,
                            })
                          }
                          placeholder="123 Main Street"
                          data-testid="customer-address-input"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={customer.city}
                            onChange={(e) =>
                              setCustomer({ ...customer, city: e.target.value })
                            }
                            placeholder="Austin"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={customer.state}
                            onChange={(e) =>
                              setCustomer({
                                ...customer,
                                state: e.target.value,
                              })
                            }
                            placeholder="TX"
                          />
                        </div>
                        <div>
                          <Label htmlFor="zip">ZIP *</Label>
                          <Input
                            id="zip"
                            value={customer.zip_code}
                            onChange={(e) =>
                              setCustomer({
                                ...customer,
                                zip_code: e.target.value,
                              })
                            }
                            placeholder="78701"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Special Instructions */}
              <Card className="consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">
                    Special Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requests for your order?"
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 consumer-theme-panel">
                <CardHeader>
                  <CardTitle className="font-heading">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="consumer-theme-muted">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="consumer-theme-muted">Tax</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Tip */}
                  <div>
                    <Label className="mb-2 block">Add a Tip</Label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[0, 2, 3, 5].map((amount) => (
                        <Button
                          key={amount}
                          variant={
                            tip === amount && !customTip ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleTipSelect(amount)}
                          style={
                            tip === amount && !customTip
                              ? { backgroundColor: primaryColor }
                              : {}
                          }
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      placeholder="Custom tip"
                      value={customTip}
                      onChange={(e) => handleCustomTip(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span
                      className="text-2xl font-bold"
                      style={{ color: primaryColor }}
                    >
                      ${finalTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment (Mocked) */}
                  <div className="p-3 consumer-theme-panel-strong rounded-lg flex items-center gap-3">
                    <CreditCard className="w-5 h-5 consumer-theme-muted" />
                    <div>
                      <p className="font-medium text-sm">Payment (Demo Mode)</p>
                      <p className="text-xs consumer-theme-muted">
                        Card ending in 4242
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12"
                    style={{ backgroundColor: primaryColor }}
                    onClick={handlePlaceOrder}
                    disabled={submitting || items.length === 0}
                    data-testid="place-order-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Place Order • $${finalTotal.toFixed(2)}`
                    )}
                  </Button>

                  <p className="text-xs consumer-theme-muted text-center">
                    By placing your order, you agree to our terms of service.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 consumer-theme-panel-strong border-t p-4 lg:hidden">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between consumer-theme-muted">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between consumer-theme-muted">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between consumer-theme-muted">
                  <span>Tip</span>
                  <span>${tip.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t">
                <span>Total</span>
                <span style={{ color: primaryColor }}>
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              className="w-full h-12"
              style={{ backgroundColor: primaryColor }}
              onClick={handlePlaceOrder}
              disabled={submitting || items.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Place Order • $${finalTotal.toFixed(2)}`
              )}
            </Button>
          </div>
        </div>
      </div>
    </ConsumerLayout>
  );
};

export default CartPage;
