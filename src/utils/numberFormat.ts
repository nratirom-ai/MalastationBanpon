/**
 * Helper to format quantity to 2 decimal places.
 * Example: 15 -> "15.00", 12.5 -> "12.50", 0.75 -> "0.75"
 */
export const formatQty = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Safely parse input string to a 2-decimal rounded number.
 */
export const parseQty = (val: string | number): number => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

/**
 * Format currency amount with commas and 2 decimals.
 */
export const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
