import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "../../stores/cartStore";
import { apiService } from "../../context/AppContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  ShoppingBag,
  MapPin,
  Clock,
  CreditCard,
  User,
  Mail,
  Phone,
  ChevronRight,
  Check,
  Sparkles,
  AlertCircle,
  Loader2,
  Calendar,
  Home,
  Store,
  Zap,
  DollarSign,
  Delete,
} from "lucide-react";

const CheckoutPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, getSubtotal, getTax, getTotal, clearCart, merchantId } =
    useCartStore();

  const [step, setStep] = useState(1); // 1: Info, 2: Payment, 3: Review
  const [loading, setLoading] = useState(false);
  const [merchant, setMerchant] = useState(null);

  const initialCustomerInfo = {
    name: "",
    email: "",
    phone: "",
  };

  const initialDeliveryAddress = {
    street: "",
    apt: "",
    city: "",
    state: "",
    zip: "",
    instructions: "",
  };

  // Form state
  const [customerInfo, setCustomerInfo] = useState(initialCustomerInfo);

  // Delivery address state
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialDeliveryAddress,
  );

  // Saved addresses from localStorage
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState("");
  const [saveThisAddress, setSaveThisAddress] = useState(false);

  const [orderType, setOrderType] = useState("pickup"); // pickup or delivery
  const [orderTiming, setOrderTiming] = useState("asap"); // asap, advance, future
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(null); // null, 10, 15, 20, or 'custom'
  const [customTipInput, setCustomTipInput] = useState("");
  const [customTipModalOpen, setCustomTipModalOpen] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const isCardPayment = paymentMethod === "demo_card";
  const effectiveTipAmount = isCardPayment ? tipAmount : 0;
  const subtotal = getSubtotal();
  const tax = getTax();
  const deliveryFee = orderType === "delivery" ? 4.99 : 0;
  const total = getTotal() + deliveryFee + effectiveTipAmount;

  const hasValidImage = (item) => Boolean(item.image && !failedImages[item.id]);

  // Load saved customer info and addresses from localStorage
  useEffect(() => {
    const savedCustomerInfo = localStorage.getItem("rnoo_customer_info");
    if (savedCustomerInfo) {
      try {
        setCustomerInfo(JSON.parse(savedCustomerInfo));
      } catch (e) {
        console.error("Failed to load customer info:", e);
      }
    }

    const savedAddressesList = localStorage.getItem("rnoo_saved_addresses");
    if (savedAddressesList) {
      try {
        setSavedAddresses(JSON.parse(savedAddressesList));
      } catch (e) {
        console.error("Failed to load saved addresses:", e);
      }
    }
  }, []);

  // Save customer info to localStorage when it changes
  useEffect(() => {
    if (customerInfo.name && customerInfo.phone) {
      localStorage.setItem("rnoo_customer_info", JSON.stringify(customerInfo));
    }
  }, [customerInfo]);

  const loadMerchant = useCallback(async () => {
    try {
      const res = await apiService.getMerchantBySlug(slug);
      setMerchant(res.data);
    } catch (err) {
      console.error("Failed to load merchant:", err);
    }
  }, [slug]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  useEffect(() => {
    if (paymentMethod !== "demo_card") {
      setTipAmount(0);
      setTipPercentage(null);
      setCustomTipInput("");
      setCustomTipModalOpen(false);
    }
  }, [paymentMethod]);

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const startHour = orderTiming === "asap" ? now.getHours() + 1 : 10;

    for (let hour = startHour; hour <= 21; hour++) {
      for (let min of ["00", "15", "30", "45"]) {
        if (hour === 21 && min !== "00") continue;
        const time24 = `${hour.toString().padStart(2, "0")}:${min}`;
        const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? "PM" : "AM";
        slots.push({ value: time24, label: `${hour12}:${min} ${ampm}` });
      }
    }
    return slots;
  };

  // Generate future dates (next 7 days)
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const value = date.toISOString().split("T")[0];
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
      dates.push({ value, label });
    }
    return dates;
  };

  const handleSubmit = async () => {
    // Validate customer info
    if (!customerInfo.name.trim()) {
      toast.error("Please enter your full name");
      setStep(1);
      return;
    }

    if (!customerInfo.phone.trim()) {
      toast.error("Please enter your phone number");
      setStep(1);
      return;
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method");
      setStep(2);
      return;
    }

    // Validate delivery address if delivery
    if (
      orderType === "delivery" &&
      (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.zip)
    ) {
      toast.error("Please complete delivery address (street, city, ZIP)");
      setStep(1);
      return;
    }

    // Validate schedule if not ASAP
    if (orderTiming !== "asap" && (!scheduledDate || !scheduledTime)) {
      toast.error("Please select both a date and time");
      setStep(1);
      return;
    }

    // Save address if requested
    if (orderType === "delivery" && saveThisAddress) {
      const addressToSave = {
        id: Date.now().toString(),
        nickname: `${deliveryAddress.street}, ${deliveryAddress.city}`,
        ...deliveryAddress,
      };

      const updatedAddresses = [...savedAddresses, addressToSave];
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(
        "rnoo_saved_addresses",
        JSON.stringify(updatedAddresses),
      );
      toast.success("Address saved for next time!");
    }

    setLoading(true);

    try {
      // Map frontend order timing to backend enum
      const orderTimingMap = {
        asap: "ASAP",
        advance: "ADVANCE",
        future: "FUTURE",
      };

      // Map frontend order type to backend enum
      const deliveryTypeMap = {
        pickup: "TAKEOUT",
        delivery: "DELIVERY",
      };

      // Prepare order data matching backend OrderCreate model
      const paymentMethodMap = {
        demo_card: "mock_card",
        cash: "cash",
        pay_at_store: "pay_at_store",
      };

      const orderData = {
        merchant_id: merchantId,
        customer: {
          name: customerInfo.name,
          email: customerInfo.email || "guest@rnoo.com", // Backend requires email
          phone: customerInfo.phone,
          address_line1:
            orderType === "delivery" ? deliveryAddress.street : null,
          address_line2: orderType === "delivery" ? deliveryAddress.apt : null,
          city: orderType === "delivery" ? deliveryAddress.city : null,
          state: orderType === "delivery" ? deliveryAddress.state : null,
          zip_code: orderType === "delivery" ? deliveryAddress.zip : null,
        },
        delivery_type: deliveryTypeMap[orderType],
        items: items.map((item) => ({
          menu_item_id: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.basePrice,
          plu: item.plu || "",
          shepherd_pos_id: item.shepherd_pos_id || "",
          modifiers: (item.modifiers || []).map((mod) => ({
            group_id: mod.group_id || "default",
            group_name: mod.group_name || "Modifier",
            option_id: mod.option_id || "default",
            option_name: mod.option_name || mod.name || "Option",
            price: mod.price || 0,
            plu: mod.plu || "",
            shepherd_pos_id: mod.shepherd_pos_id || "",
          })),
          special_instructions: item.specialInstructions || null,
        })),
        payment: {
          method: paymentMethodMap[paymentMethod] || "cash",
          amount: total,
          tip: effectiveTipAmount,
          status: "pending",
        },
        order_timing: orderTimingMap[orderTiming],
        scheduled_date:
          orderTiming !== "asap"
            ? scheduledDate || new Date().toISOString().split("T")[0]
            : null,
        scheduled_time: orderTiming !== "asap" ? scheduledTime : null,
        notes:
          orderType === "delivery" && deliveryAddress.instructions
            ? deliveryAddress.instructions
            : null,
      };

      const res = await apiService.createOrder(orderData);

      console.log("Order created successfully:", res.data);
      console.log("Order ID:", res.data.id);

      // Clear cart
      clearCart();

      // Clear customer data so the next order starts fresh.
      setCustomerInfo(initialCustomerInfo);
      setDeliveryAddress(initialDeliveryAddress);
      localStorage.removeItem("rnoo_customer_info");

      // Show success with order ID
      toast.success("Order placed successfully!");

      navigate(
        `/order-confirmation?orderId=${encodeURIComponent(res.data.id)}&merchantSlug=${encodeURIComponent(slug)}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
      );
    } catch (err) {
      console.error("Failed to place order:", err);

      // Handle error properly - check if detail is an array or string
      let errorMessage = "Failed to place order";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Pydantic validation errors
          errorMessage = detail
            .map((e) => e.msg || e.message || JSON.stringify(e))
            .join(", ");
        } else if (typeof detail === "object") {
          errorMessage = detail.msg || detail.message || JSON.stringify(detail);
        }
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, name: "Your Info", icon: User },
    { id: 2, name: "Payment", icon: CreditCard },
    { id: 3, name: "Review", icon: Check },
  ];

  const timeSlots = generateTimeSlots();
  const dateOptions = generateDateOptions();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/order/${slug}`)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu</span>
            </button>

            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-3xl mx-auto px-3 py-5">
        <div className="flex items-center justify-between mb-7">
          {steps.map((s, index) => (
            <React.Fragment key={s.id}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center"
              >
                <div
                  className={`
                  w-8 h-8 rounded-xl flex items-center justify-center
                  transition-all duration-300
                  ${
                    step >= s.id
                      ? "bg-orange-500 text-white"
                      : "bg-white/5 text-zinc-500"
                  }
                `}
                >
                  {step > s.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <s.icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`
                  mt-1.5 text-xs font-medium
                  ${step >= s.id ? "text-white" : "text-zinc-500"}
                `}
                >
                  {s.name}
                </span>
              </motion.div>

              {index < steps.length - 1 && (
                <div
                  className={`
                  flex-1 h-0.5 mx-2
                  ${step > s.id ? "bg-orange-500" : "bg-white/10"}
                  transition-colors duration-300
                `}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {/* Step 1: Customer Info */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold">Your Information</h2>

                  {/* Order Type */}
                  <div className="space-y-3">
                    <label className="text-sm text-zinc-400">Order Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "pickup", label: "Pickup", icon: MapPin },
                        { id: "delivery", label: "Delivery", icon: Home },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setOrderType(type.id)}
                          className={`
                            p-2.5 rounded-xl border transition-all
                            ${
                              orderType === type.id
                                ? "bg-orange-500/20 border-orange-500 text-white"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                            }
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <type.icon className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {type.label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order Timing */}
                  <div className="space-y-3">
                    <label className="text-sm text-zinc-400">
                      When do you want it?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          id: "asap",
                          label: "ASAP",
                          icon: Zap,
                          desc: "20-30 min",
                        },
                        {
                          id: "advance",
                          label: "Later Today",
                          icon: Clock,
                          desc: "Schedule",
                        },
                        {
                          id: "future",
                          label: "Future Date",
                          icon: Calendar,
                          desc: "Pick a day",
                        },
                      ].map((timing) => (
                        <button
                          key={timing.id}
                          onClick={() => {
                            setOrderTiming(timing.id);
                            if (timing.id === "asap") {
                              setScheduledDate("");
                              setScheduledTime("");
                            } else if (timing.id === "advance") {
                              setScheduledDate(
                                new Date().toISOString().split("T")[0],
                              );
                            }
                          }}
                          className={`
                            p-2.5 rounded-xl border transition-all text-left
                            ${
                              orderTiming === timing.id
                                ? "bg-orange-500/20 border-orange-500 text-white"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                            }
                          `}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <timing.icon className="w-3.5 h-3.5" />
                            <span className="font-medium text-xs">
                              {timing.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            {timing.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Selection (for Future orders) */}
                  {orderTiming === "future" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3"
                    >
                      <label className="text-sm text-zinc-400">
                        Select Date
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {dateOptions.map((date) => (
                          <button
                            key={date.value}
                            onClick={() => setScheduledDate(date.value)}
                            className={`
                              p-2 rounded-lg border text-xs transition-all
                              ${
                                scheduledDate === date.value
                                  ? "bg-orange-500/20 border-orange-500 text-white"
                                  : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                              }
                            `}
                          >
                            {date.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Time Selection (for Advance/Future orders) */}
                  {orderTiming !== "asap" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3"
                    >
                      <label className="text-sm text-zinc-400">
                        Select Time
                      </label>
                      <select
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                      >
                        <option value="">Select a time...</option>
                        {timeSlots.map((slot) => (
                          <option
                            key={slot.value}
                            value={slot.value}
                            className="bg-zinc-900"
                          >
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </motion.div>
                  )}

                  {/* Delivery Address (for Delivery orders) */}
                  {orderType === "delivery" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10"
                    >
                      <h3 className="font-semibold flex items-center gap-2">
                        <Home className="w-4 h-4 text-orange-400" />
                        Delivery Address
                      </h3>

                      {/* Saved Addresses Dropdown */}
                      {savedAddresses.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm text-zinc-400">
                            Use a saved address
                          </label>
                          <select
                            value={selectedSavedAddress}
                            onChange={(e) => {
                              setSelectedSavedAddress(e.target.value);
                              if (e.target.value) {
                                const address = savedAddresses.find(
                                  (a) => a.id === e.target.value,
                                );
                                if (address) {
                                  setDeliveryAddress({
                                    street: address.street,
                                    apt: address.apt || "",
                                    city: address.city,
                                    state: address.state || "",
                                    zip: address.zip,
                                    instructions: address.instructions || "",
                                  });
                                }
                              }
                            }}
                            className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50"
                          >
                            <option value="" className="bg-zinc-900">
                              Enter new address
                            </option>
                            {savedAddresses.map((addr) => (
                              <option
                                key={addr.id}
                                value={addr.id}
                                className="bg-zinc-900"
                              >
                                {addr.nickname ||
                                  `${addr.street}, ${addr.city}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3">
                        <input
                          type="text"
                          value={deliveryAddress.street}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              street: e.target.value,
                            })
                          }
                          placeholder="Street Address *"
                          className="w-full h-12 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                        />
                        <input
                          type="text"
                          value={deliveryAddress.apt}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              apt: e.target.value,
                            })
                          }
                          placeholder="Apt, Suite, Unit (optional)"
                          className="w-full h-12 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={deliveryAddress.city}
                            onChange={(e) =>
                              setDeliveryAddress({
                                ...deliveryAddress,
                                city: e.target.value,
                              })
                            }
                            placeholder="City *"
                            className="w-full h-12 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                          />
                          <input
                            type="text"
                            value={deliveryAddress.state}
                            onChange={(e) =>
                              setDeliveryAddress({
                                ...deliveryAddress,
                                state: e.target.value,
                              })
                            }
                            placeholder="State"
                            className="w-full h-12 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                          />
                          <input
                            type="text"
                            value={deliveryAddress.zip}
                            onChange={(e) =>
                              setDeliveryAddress({
                                ...deliveryAddress,
                                zip: e.target.value,
                              })
                            }
                            placeholder="ZIP *"
                            className="w-full h-12 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                          />
                        </div>
                        <textarea
                          value={deliveryAddress.instructions}
                          onChange={(e) =>
                            setDeliveryAddress({
                              ...deliveryAddress,
                              instructions: e.target.value,
                            })
                          }
                          placeholder="Delivery instructions (gate code, landmarks, etc.)"
                          className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 resize-none h-20"
                        />
                      </div>

                      {/* Save Address Checkbox */}
                      {!selectedSavedAddress && deliveryAddress.street && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveThisAddress}
                            onChange={(e) =>
                              setSaveThisAddress(e.target.checked)
                            }
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-sm text-zinc-300">
                            Save this address for future orders
                          </span>
                        </label>
                      )}
                    </motion.div>
                  )}

                  {/* Customer Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Contact Information</h3>
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          value={customerInfo.name}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              name: e.target.value,
                            })
                          }
                          placeholder="John Doe"
                          className="w-full h-12 pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="email"
                          value={customerInfo.email}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              email: e.target.value,
                            })
                          }
                          placeholder="john@example.com"
                          className="w-full h-12 pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              phone: e.target.value,
                            })
                          }
                          placeholder="(555) 123-4567"
                          className="w-full h-12 pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    disabled={
                      !customerInfo.name ||
                      !customerInfo.phone ||
                      (orderType === "delivery" &&
                        (!deliveryAddress.street ||
                          !deliveryAddress.city ||
                          !deliveryAddress.zip))
                    }
                    className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-sm text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    Continue to Payment
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold">Payment Method</h2>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Apple Pay is not available in demo mode")
                      }
                      className="h-11 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-white"
                        aria-hidden
                      >
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Apple Pay
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Google Pay is not available in demo mode")
                      }
                      className="h-11 rounded-xl border-2 border-zinc-700 bg-white/5 font-bold text-sm flex items-center justify-center gap-2 text-white"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google Pay
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs text-zinc-500 uppercase">
                      or select below
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        id: "demo_card",
                        label: "Demo Credit Card",
                        icon: CreditCard,
                      },
                      {
                        id: "pay_at_store",
                        label: "Pay at Store",
                        icon: Store,
                      },
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`
                          w-full p-2.5 rounded-xl border transition-all flex items-center gap-3
                          ${
                            paymentMethod === method.id
                              ? "bg-orange-500/20 border-orange-500 text-white"
                              : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                          }
                        `}
                      >
                        <div
                          className={`
                          w-8 h-8 rounded-lg flex items-center justify-center
                          ${paymentMethod === method.id ? "bg-orange-500" : "bg-white/10"}
                        `}
                        >
                          <method.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">
                          {method.label}
                        </span>
                        {paymentMethod === method.id && (
                          <Check className="w-4 h-4 ml-auto text-orange-400" />
                        )}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "demo_card" && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-amber-200 font-medium">
                            Demo Mode
                          </p>
                          <p className="text-amber-200/70 text-sm">
                            Payment processing is simulated. No real charges
                            will be made.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tip Section */}
                  {isCardPayment && (
                    <div className="space-y-3">
                      <label className="text-sm text-zinc-400">
                        Add a tip for the staff
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { value: 10, label: "10%" },
                          { value: 15, label: "15%" },
                          { value: 20, label: "20%" },
                          { value: "custom", label: "Custom" },
                        ].map((tip) => (
                          <button
                            key={tip.value}
                            onClick={() => {
                              setTipPercentage(tip.value);
                              if (tip.value !== "custom") {
                                const calculatedTip =
                                  Math.round(
                                    ((subtotal * tip.value) / 100 +
                                      Number.EPSILON) *
                                      100,
                                  ) / 100;
                                setTipAmount(calculatedTip);
                                setCustomTipInput("");
                              } else {
                                setCustomTipModalOpen(true);
                              }
                            }}
                            className={`
                            p-2 rounded-lg border transition-all
                            ${
                              tipPercentage === tip.value
                                ? "bg-orange-500/20 border-orange-500 text-white"
                                : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                            }
                          `}
                          >
                            <div className="text-xs font-medium">
                              {tip.label}
                            </div>
                            {tip.value !== "custom" && (
                              <div className="text-[10px] text-zinc-500 mt-1">
                                ${((subtotal * tip.value) / 100).toFixed(2)}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Custom Tip Modal */}
                      <Dialog
                        open={customTipModalOpen}
                        onOpenChange={setCustomTipModalOpen}
                      >
                        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold">
                              Enter Custom Tip
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400">
                              Enter the amount you'd like to tip the staff
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            {/* Display */}
                            <div className="relative">
                              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400" />
                              <div className="w-full pl-14 pr-4 py-4 bg-white/5 border-2 border-orange-500/30 rounded-xl text-white text-3xl font-bold text-center">
                                {customTipInput || "0.00"}
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500 text-center">
                              Order subtotal: ${subtotal.toFixed(2)}
                            </p>

                            {/* Number Pad */}
                            <div className="grid grid-cols-3 gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                  key={num}
                                  onClick={() => {
                                    const newValue =
                                      customTipInput + num.toString();
                                    // Prevent more than 2 decimal places
                                    if (customTipInput.includes(".")) {
                                      const parts = customTipInput.split(".");
                                      if (parts[1]?.length >= 2) return;
                                    }
                                    setCustomTipInput(newValue);
                                  }}
                                  className="h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xl font-semibold transition-all active:scale-95"
                                >
                                  {num}
                                </button>
                              ))}
                              <button
                                onClick={() => {
                                  if (!customTipInput.includes(".")) {
                                    setCustomTipInput(customTipInput + ".");
                                  }
                                }}
                                className="h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xl font-semibold transition-all active:scale-95"
                              >
                                .
                              </button>
                              <button
                                onClick={() => {
                                  const newValue = customTipInput + "0";
                                  // Prevent more than 2 decimal places
                                  if (customTipInput.includes(".")) {
                                    const parts = customTipInput.split(".");
                                    if (parts[1]?.length >= 2) return;
                                  }
                                  setCustomTipInput(newValue);
                                }}
                                className="h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xl font-semibold transition-all active:scale-95"
                              >
                                0
                              </button>
                              <button
                                onClick={() => {
                                  setCustomTipInput(
                                    customTipInput.slice(0, -1),
                                  );
                                }}
                                className="h-14 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-white transition-all active:scale-95 flex items-center justify-center"
                              >
                                <Delete className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setCustomTipModalOpen(false);
                                setTipPercentage(null);
                                setCustomTipInput("");
                                setTipAmount(0);
                              }}
                              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                const amount = parseFloat(customTipInput) || 0;
                                setTipAmount(amount);
                                setCustomTipModalOpen(false);
                                if (amount > 0) {
                                  toast.success(
                                    `Custom tip of $${amount.toFixed(2)} added!`,
                                  );
                                }
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              Apply Tip
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Thank you message for any tip */}
                      {effectiveTipAmount > 0 && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                          <div className="flex items-center justify-between text-green-400">
                            <span className="text-sm">
                              Thank you for your tip!
                            </span>
                            <span className="font-semibold">
                              ${effectiveTipAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white font-semibold rounded-xl transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!paymentMethod}
                      className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-sm text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      Review Order
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold">Review Your Order</h2>

                  {/* Order Summary Cards */}
                  <div className="grid gap-4">
                    {/* Customer Info Summary */}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                      <h4 className="font-semibold text-sm text-zinc-400 mb-3">
                        Contact
                      </h4>
                      <div className="flex items-center gap-2 text-white">
                        <User className="w-4 h-4 text-orange-400" />
                        <span>{customerInfo.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <Phone className="w-4 h-4 text-orange-400" />
                        <span>{customerInfo.phone}</span>
                      </div>
                      {customerInfo.email && (
                        <div className="flex items-center gap-2 text-white">
                          <Mail className="w-4 h-4 text-orange-400" />
                          <span>{customerInfo.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Order Type & Timing */}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                      <h4 className="font-semibold text-sm text-zinc-400 mb-3">
                        Order Details
                      </h4>
                      <div className="flex items-center gap-2 text-white">
                        {orderType === "pickup" ? (
                          <MapPin className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Home className="w-4 h-4 text-orange-400" />
                        )}
                        <span className="capitalize">{orderType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span>
                          {orderTiming === "asap"
                            ? "ASAP (20-30 min)"
                            : `${scheduledDate} at ${scheduledTime}`}
                        </span>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    {orderType === "delivery" && deliveryAddress.street && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <h4 className="font-semibold text-sm text-zinc-400 mb-3">
                          Delivery Address
                        </h4>
                        <p className="text-white">
                          {deliveryAddress.street}
                          {deliveryAddress.apt && `, ${deliveryAddress.apt}`}
                          <br />
                          {deliveryAddress.city}, {deliveryAddress.state}{" "}
                          {deliveryAddress.zip}
                        </p>
                        {deliveryAddress.instructions && (
                          <p className="text-sm text-zinc-400 mt-2">
                            Note: {deliveryAddress.instructions}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-zinc-400">
                      Items
                    </h4>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-2.5 p-2.5 bg-white/5 rounded-lg"
                      >
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {hasValidImage(item) ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() =>
                                setFailedImages((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                            />
                          ) : (
                            <Sparkles className="w-4 h-4 text-orange-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium">{item.name}</h4>
                          {item.modifiers?.length > 0 && (
                            <p className="text-xs text-zinc-400">
                              {item.modifiers
                                .map((m) => m.option_name)
                                .join(", ")}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-zinc-400">
                              Qty: {item.quantity}
                            </span>
                            <span className="font-medium text-orange-400">
                              ${item.totalPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white font-semibold rounded-xl transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !paymentMethod}
                      className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-zinc-700 disabled:to-zinc-700 text-sm text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Placing Order...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          {`Place Order • $${total.toFixed(2)}`}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 p-4 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-base font-semibold mb-3">Order Summary</h3>

              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-zinc-400">
                      {item.quantity}x {item.name}
                    </span>
                    <span>${item.totalPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {effectiveTipAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Tip</span>
                    <span className="text-green-400">
                      ${effectiveTipAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-orange-400">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Timing Badge */}
              <div className="mt-4 p-3 bg-zinc-800/50 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  {orderTiming === "asap" ? (
                    <>
                      <Zap className="w-4 h-4 text-orange-400" />
                      <span className="text-white font-medium">ASAP</span>
                      <span className="text-zinc-400">~20-30 min</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span className="text-white font-medium">Scheduled</span>
                      <span className="text-zinc-400">
                        {scheduledTime || "Select time"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Pickup/Delivery Location */}
              {merchant && (
                <div className="mt-4 p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                    {orderType === "pickup" ? (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>Pickup Location</span>
                      </>
                    ) : (
                      <>
                        <Home className="w-4 h-4" />
                        <span>Delivering From</span>
                      </>
                    )}
                  </div>
                  <p className="text-white font-medium">{merchant.name}</p>
                  <p className="text-sm text-zinc-400">
                    {merchant.address_line1}, {merchant.city}, {merchant.state}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
