import { catalogPriceInToman } from './catalogScale';

/**
 * Per-edit cap the API enforces on an admin balance change, in Toman
 * (`price_display.ADMIN_BALANCE_EDIT_MAX_TOMAN`). Mirrored here so a form cannot offer an amount
 * the backend refuses with a 422.
 */
export const ADMIN_BALANCE_EDIT_MAX_TOMAN = 10_000_000;

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

/**
 * Message key for a failed admin balance edit. The API answers 422 on an amount
 * above the per-edit cap (10,000,000 Toman); any other failure gets the generic text.
 */
export function adminBalanceErrorKey(error: unknown): string {
  const response = (
    error as { response?: { status?: number; data?: { detail?: unknown } } } | undefined
  )?.response;
  const detail = Array.isArray(response?.data?.detail) ? response.data.detail : [];
  const amountRefused = detail.some(
    (item: { loc?: unknown[] }) =>
      Array.isArray(item?.loc) &&
      item.loc.some((part) => part === 'amount_display' || part === 'amount_kopeks'),
  );
  return response?.status === 422 && amountRefused
    ? 'admin.users.detail.balance.updateLimit'
    : 'admin.users.detail.balance.updateError';
}

/**
 * Params for the admin bulk «add balance» action. Balances are stored Toman 1:1, so the typed
 * «مبلغ (تومان)» goes out unchanged as `amount_display` — the same contract as the single-user
 * editor. Sending `amount_kopeks = typed × 100` credited every selected user 100x (F-068).
 */
export function bulkAddBalanceParams(amountToman: number): { amount_display: number } {
  return { amount_display: Math.round(amountToman) };
}
