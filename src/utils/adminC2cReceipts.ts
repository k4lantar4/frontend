import type {
  C2cApprovePayload,
  C2cReceiptListParams,
  C2cReceiptStatsParams,
  C2cRejectPayload,
  C2cStatusFilter,
} from '../api/adminC2cReceipts';
import { tomanToCatalogKopeks } from './catalogScale';
import { toLatinDigits } from './c2cTopUp';

/** UI state of the receipt review list; turned into request params only here. */
export type C2cPeriod = '24h' | '7d' | '30d' | 'all' | 'custom';

export interface C2cReceiptFilters {
  status: C2cStatusFilter;
  search: string;
  period: C2cPeriod;
  /** 'YYYY-MM-DD' from DateField, used only when `period` is 'custom'. */
  dateFrom: string;
  dateTo: string;
}

export const C2C_RECEIPTS_PER_PAGE = 20;

// All time by default: a pending receipt older than a day must not drop out of the review queue.
export const DEFAULT_C2C_FILTERS: C2cReceiptFilters = {
  status: 'all',
  search: '',
  period: 'all',
  dateFrom: '',
  dateTo: '',
};

const PRESET_HOURS: Record<Exclude<C2cPeriod, 'all' | 'custom'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

function localMidnight(value: string, addDays = 0): Date | undefined {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d + addDays);
}

function dateRange(filters: C2cReceiptFilters, now: Date): C2cReceiptStatsParams {
  const range: C2cReceiptStatsParams = {};
  if (filters.period === 'custom') {
    // DateField picks local days; the API's date_to is exclusive, so the last day ends at the
    // next local midnight.
    const from = filters.dateFrom ? localMidnight(filters.dateFrom) : undefined;
    const to = filters.dateTo ? localMidnight(filters.dateTo, 1) : undefined;
    if (from) range.date_from = from.toISOString();
    if (to) range.date_to = to.toISOString();
  } else if (filters.period !== 'all') {
    range.date_from = new Date(
      now.getTime() - PRESET_HOURS[filters.period] * 3600 * 1000,
    ).toISOString();
  }
  return range;
}

export function buildC2cStatsParams(
  filters: C2cReceiptFilters,
  now: Date = new Date(),
): C2cReceiptStatsParams {
  const search = filters.search.trim();
  return { ...(search ? { search } : {}), ...dateRange(filters, now) };
}

export function buildC2cListParams(
  filters: C2cReceiptFilters,
  page: number,
  now: Date = new Date(),
): C2cReceiptListParams {
  return {
    status: filters.status,
    ...buildC2cStatsParams(filters, now),
    page,
    per_page: C2C_RECEIPTS_PER_PAGE,
  };
}

/** Auto-refresh only while the owner is watching the default queue, as AdminPayments does. */
export function isDefaultC2cFilters(filters: C2cReceiptFilters): boolean {
  return !filters.search.trim() && filters.status === 'all' && filters.period === 'all';
}

export type C2cApproveBuild =
  | { ok: true; payload: C2cApprovePayload }
  | { ok: false; errorKey: string };

/**
 * `customAmount` null = credit the requested amount (no `amount_kopeks` at all). A typed Toman
 * amount leaves on the x100 wire scale; the method limits are enforced by the backend (400).
 */
export function buildC2cApprovePayload(customAmount: string | null): C2cApproveBuild {
  if (customAmount === null) return { ok: true, payload: {} };
  const cleaned = toLatinDigits(customAmount).replace(/[\s,٬]/g, '');
  const toman = cleaned === '' ? Number.NaN : Number(cleaned);
  if (!Number.isFinite(toman) || Math.round(toman) <= 0) {
    return { ok: false, errorKey: 'admin.c2cReceipts.detail.errors.enterAmount' };
  }
  return { ok: true, payload: { amount_kopeks: tomanToCatalogKopeks(Math.round(toman)) } };
}

export function buildC2cRejectPayload(reasonKey: string, comment: string): C2cRejectPayload | null {
  if (!reasonKey) return null;
  const note = comment.trim();
  return note ? { reason_key: reasonKey, comment: note } : { reason_key: reasonKey };
}

/** A decided receipt is read-only for everyone; a pending one only for admins without payments:edit. */
export function canDecideC2cReceipt(status: string, canEdit: boolean): boolean {
  return status === 'pending' && canEdit;
}
