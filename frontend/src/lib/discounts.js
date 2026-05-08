export const toMoney = (value) => {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
};

export const normalizeDiscountCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase();
};

export const getActiveDiscountOptions = (merchant) => {
  const options = Array.isArray(merchant?.discount_options)
    ? merchant.discount_options
    : [];
  return options.filter((option) => option?.is_active !== false);
};

export const findDiscountByCode = (merchant, code) => {
  const normalizedCode = normalizeDiscountCode(code);
  if (!normalizedCode) return null;
  return (
    getActiveDiscountOptions(merchant).find(
      (option) => normalizeDiscountCode(option?.code) === normalizedCode,
    ) || null
  );
};

export const calculateDiscountAmount = (baseAmount, discountOption) => {
  if (!discountOption) return 0;

  const base = toMoney(baseAmount);
  const rawValue = Number(discountOption?.value || 0);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 0;

  let discount = 0;
  if (String(discountOption?.discount_type) === "percent") {
    discount = toMoney((base * rawValue) / 100);
  } else {
    discount = toMoney(rawValue);
  }

  if (
    discountOption?.max_discount_amount !== null &&
    discountOption?.max_discount_amount !== undefined
  ) {
    const maxCap = Number(discountOption.max_discount_amount);
    if (Number.isFinite(maxCap) && maxCap >= 0) {
      discount = Math.min(discount, toMoney(maxCap));
    }
  }

  return Math.min(discount, base);
};
