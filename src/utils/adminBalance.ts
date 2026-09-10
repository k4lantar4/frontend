import { catalogPriceInToman } from './catalogScale';

/**
 * Admin balance edit payload. The balance is stored Toman 1:1, so the typed
 * «مبلغ به تومان» goes out unchanged as `amount_display` (never ×100).
 */
export function adminBalanceUpdatePayload(
  amountToman: number,
  isAdd: boolean,
  description: string,
): { amount_display: number; description: string } {
  const amount = Math.abs(amountToman);
  return { amount_display: isAdd ? amount : -amount, description };
}

/**
 * Display Toman for an activity-feed amount. The backend sends `amount_toman`
 * when it knows the source's storage scale (transactions: deposit 1:1,
 * subscription_payment ÷100); older backends and other sources fall back to
 * the legacy catalog reading of `amount_kopeks`.
 */
export function activityAmountToman(item: {
  amount_kopeks: number | null;
  amount_toman?: number | null;
}): number | null {
  if (item.amount_toman != null) return item.amount_toman;
  if (item.amount_kopeks == null) return null;
  return catalogPriceInToman(item.amount_kopeks);
}

/** Dashboard payment total in Toman; legacy backends only send the raw kopeks sum. */
export function paymentsTotalToman(toman: number | null | undefined, legacyKopeks: number): number {
  if (toman != null) return toman;
  return catalogPriceInToman(legacyKopeks);
}
