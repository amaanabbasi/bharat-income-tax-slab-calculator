const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234567 → "12,34,567" (Indian digit grouping). */
export function formatAmount(value: number, decimals: 0 | 2 = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  // Avoid "-0" for tiny negatives left over from floating point.
  const rounded = Math.abs(safe) < 0.005 ? 0 : safe;
  return (decimals === 2 ? paise : whole).format(rounded);
}

export function formatRupees(value: number, decimals: 0 | 2 = 0): string {
  return `₹${formatAmount(value, decimals)}`;
}

/** Rounds to paise without the 1.005 → 1.00 floating-point trap. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Sections 288A (total income) and 288B (tax): ignore paise, then round to the nearest
 * multiple of ten, where a last digit of 5 or more rounds up.
 */
export function roundToTen(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const rupees = Math.floor(Math.abs(value) + 1e-9);
  const last = rupees % 10;
  return sign * (last >= 5 ? rupees + 10 - last : rupees - last);
}

/** 0.55 → "55%", 0.275 → "27.5%". */
export function percent(rate: number): string {
  const value = Math.round(rate * 10000) / 100;
  return `${value}%`;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20)
    return ONES[n];
  const ones = n % 10;
  return TENS[Math.floor(n / 10)] + (ones ? `-${ONES[ones]}` : '');
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** 302322 → "Three Lakh Two Thousand Three Hundred Twenty-Two" (Indian system). */
export function numberInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0)
    return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore)
    parts.push(`${numberInWords(crore)} Crore`);
  if (lakh)
    parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand)
    parts.push(`${belowHundred(thousand)} Thousand`);
  if (n)
    parts.push(belowThousand(n));
  return parts.join(' ');
}

export function rupeesInWords(amount: number): string {
  const absolute = Math.abs(amount);
  let rupees = Math.floor(absolute);
  let cents = Math.round((absolute - rupees) * 100);
  if (cents === 100) {
    rupees += 1;
    cents = 0;
  }
  const words = `Rupees ${numberInWords(rupees)}${cents ? ` and ${belowHundred(cents)} Paise` : ''} Only`;
  return amount < 0 ? `Minus ${words}` : words;
}
