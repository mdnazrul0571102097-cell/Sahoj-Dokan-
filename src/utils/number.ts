const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Parses either English digits ("123") or Bengali digits ("১২৩") into a standard number.
 */
export function parseBanglaNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  str = str.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d);
  str = str.replace(',', '.');

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}
