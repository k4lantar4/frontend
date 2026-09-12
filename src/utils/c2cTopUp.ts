import type { C2cReceiptState, C2cReceiptSubmitPayload, PaymentMethod } from '../types';
import { catalogPriceInToman, tomanToCatalogKopeks } from './catalogScale';

/** Card-to-card top-up page logic (`/balance/top-up/c2c`). Amounts here are Toman unless named kopeks. */

export type C2cStep = 'amount' | 'transfer' | 'pending' | 'approved' | 'rejected';

export const C2C_POLL_INTERVAL_MS = 15_000;
// Same limits `/cabinet/media/upload` enforces server-side.
export const C2C_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const C2C_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Which step the page shows for the receipt the server reports. */
export function c2cStepFor(state: C2cReceiptState | null | undefined): C2cStep {
  if (!state) return 'amount';
  switch (state.status) {
    case 'pending':
      return state.has_receipt ? 'pending' : 'transfer';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      // expired / cancelled: nothing left to act on, start over
      return 'amount';
  }
}

/** A receipt the owner still has to decide on — what the balance-screen banner announces. */
export function isC2cAwaitingReview(state: C2cReceiptState | null | undefined): boolean {
  return !!state && state.status === 'pending' && state.has_receipt;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export type C2cAmountCheck =
  | { ok: true; amountKopeks: number }
  | { ok: false; errorKey: string; params?: { min: number; max: number } };

/** Validate a typed Toman amount against the method's wire-scale limits; returns the wire amount. */
export function checkC2cAmount(
  input: string,
  method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks'>,
): C2cAmountCheck {
  const cleaned = toLatinDigits(input).replace(/[\s,٬]/g, '');
  const toman = cleaned === '' ? Number.NaN : Number(cleaned);
  if (!Number.isFinite(toman) || toman <= 0) {
    return { ok: false, errorKey: 'balance.c2c.errors.enterAmount' };
  }
  const amount = Math.round(toman);
  const min = catalogPriceInToman(method.min_amount_kopeks);
  const max = catalogPriceInToman(method.max_amount_kopeks);
  if (amount < min || amount > max) {
    return { ok: false, errorKey: 'balance.c2c.errors.amountRange', params: { min, max } };
  }
  return { ok: true, amountKopeks: tomanToCatalogKopeks(amount) };
}

/** The receipt request: uploaded image and note together, either alone, never neither. */
export function buildC2cReceiptPayload(
  receiptId: number,
  upload: { file_id: string; media_type: string } | null,
  note: string,
): C2cReceiptSubmitPayload | null {
  const text = note.trim();
  if (!upload && !text) return null;
  return {
    receipt_id: receiptId,
    ...(upload
      ? {
          media_file_id: upload.file_id,
          media_type: upload.media_type === 'document' ? ('document' as const) : ('photo' as const),
        }
      : {}),
    ...(text ? { text } : {}),
  };
}

/** Toman with Latin digits and thousands separators, as every Persian amount is shown. */
export function formatToman(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}
