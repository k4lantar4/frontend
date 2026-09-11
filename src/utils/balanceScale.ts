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
  if (display != null && Number.isFinite(display)) return display;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return scale === 'balance' ? raw : catalogPriceInToman(raw);
}

/** A typed Toman wallet amount (e.g. a withdrawal request) goes out 1:1 — never ×100. */
export function balanceAmountFromDisplay(amountToman: number): number {
  if (!Number.isFinite(amountToman)) return 0;
  return Math.round(amountToman);
}
