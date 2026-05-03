export const getOrderHandoffCopy = ({
  deliveryType,
  customerName,
  customerPhone,
}) => {
  const normalizedType = String(deliveryType || "").toUpperCase();
  const isDelivery = normalizedType === "DELIVERY";

  const trimmedName = (customerName || "").trim();
  const trimmedPhone = (customerPhone || "").trim();

  const fallback = trimmedPhone
    ? `Phone: ${trimmedPhone}`
    : "the name used at checkout";

  if (isDelivery) {
    return {
      title: trimmedName
        ? `Delivery for Customer Name: ${trimmedName}`
        : `Delivery for Customer Name: ${fallback}`,
      detail: "We will deliver to the address on this order.",
    };
  }

  return {
    title: trimmedName
      ? `Ask for order under Customer Name: ${trimmedName}`
      : `Ask for order under Customer Name: ${fallback}`,
    detail: "At pickup, tell the counter this customer name.",
  };
};
