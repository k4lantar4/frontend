import { catalogPriceInToman } from './catalogScale';

/**
 * Which storage scale a raw `*_kopeks` amount uses. Wallet amounts (balance, top-ups,
 * bonuses, referral earnings, withdrawals) are Toman 1:1; catalog prices are ×100.
 */
export type AmountScale = 'balance' | 'catalog';

/**
 * Display Toman for a WebSocket event amount. The bot sends `*_rubles` already on the
 * display scale; the raw `*_kopeks` fallback is read on the scale the bot declares for
 * that event.
 */
export function wsAmountToman(
  display: number | null | undefined,
  raw: number | null | undefined,
  scale: AmountScale,
): number {
  return tomanOrLegacy(display, raw, scale);
}

/**
 * Display Toman for an amount the bot sends twice: a `*_toman` field already in display
 * Toman (remnabot#40 stats aggregates, render with `formatBalance`, never ÷100) and the
 * legacy field. The legacy field is read on `legacyScale` only when `*_toman` is absent,
 * i.e. against a bot older than the field.
 */
export function tomanOrLegacy(
  toman: number | null | undefined,
  legacy: number | null | undefined,
  legacyScale: AmountScale,
): number {
  if (toman != null && Number.isFinite(toman)) return toman;
  if (legacy == null || !Number.isFinite(legacy)) return 0;
  return legacyScale === 'balance' ? legacy : catalogPriceInToman(legacy);
}

/** A typed Toman wallet amount (e.g. a withdrawal request) goes out 1:1 — never ×100. */
export function balanceAmountFromDisplay(amountToman: number): number {
  if (!Number.isFinite(amountToman)) return 0;
  return Math.round(amountToman);
}
