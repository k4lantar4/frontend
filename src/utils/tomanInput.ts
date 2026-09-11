const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Typed Toman amount → plain Latin digits. Toman has no decimals, so «,» and the
 * Arabic «٬» are thousands separators, not a decimal comma; Persian/Arabic
 * digits, spaces and a trailing «تومان» are accepted (as the bot's
 * `normalize_display_amount_text` does).
 */
export function normalizeTomanInput(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/(تومان|toman)\s*$/i, '')
    .replace(/[,٬\s]/g, '');
}
