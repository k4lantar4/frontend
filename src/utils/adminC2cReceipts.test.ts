import { describe, expect, it } from 'vitest';
import {
  buildC2cApprovePayload,
  buildC2cListParams,
  buildC2cRejectPayload,
  buildC2cStatsParams,
  c2cFiltersFromSearchParams,
  c2cFiltersToSearchParams,
  canDecideC2cReceipt,
  DEFAULT_C2C_FILTERS,
  isDefaultC2cFilters,
  type C2cReceiptFilters,
} from './adminC2cReceipts';

/**
 * The receipt review screen turns UI state into requests that move money. Two things must not
 * drift: the list filters the owner sees must be the ones the API receives (a lost `status` would
 * hide the pending queue behind decided receipts), and an approval must credit exactly what the
 * owner chose — no `amount_kopeks` unless they typed another amount, and that one on the x100 wire
 * scale.
 */

const NOW = new Date('2026-09-12T12:00:00.000Z');

const filters = (over: Partial<C2cReceiptFilters> = {}): C2cReceiptFilters => ({
  ...DEFAULT_C2C_FILTERS,
  ...over,
});

// Working a queue means opening a receipt and coming back: the filters live in the URL so Back
// (which returns to the list's full path) lands on the same status, search, period and page.
describe('c2c filters in the URL', () => {
  it('keeps the default queue URL clean', () => {
    expect(c2cFiltersToSearchParams(filters(), 1).toString()).toBe('');
    expect(c2cFiltersFromSearchParams(new URLSearchParams())).toEqual({
      filters: DEFAULT_C2C_FILTERS,
      page: 1,
    });
  });

  it('round-trips status, search, custom range and page', () => {
    const state = filters({
      status: 'pending',
      search: '@ali',
      period: 'custom',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-10',
    });
    const params = c2cFiltersToSearchParams(state, 3);
    expect(c2cFiltersFromSearchParams(new URLSearchParams(params.toString()))).toEqual({
      filters: state,
      page: 3,
    });
  });

  it('drops dates outside a custom period and ignores tampered values', () => {
    expect(
      c2cFiltersToSearchParams(filters({ period: '7d', dateFrom: '2026-09-01' }), 1).toString(),
    ).toBe('period=7d');
    expect(
      c2cFiltersFromSearchParams(
        new URLSearchParams('status=paid&period=1y&from=yesterday&to=2026-09-10&page=-2'),
      ),
    ).toEqual({ filters: { ...DEFAULT_C2C_FILTERS, dateTo: '2026-09-10' }, page: 1 });
  });
});

describe('buildC2cListParams', () => {
  it('sends only status and paging at the default filters', () => {
    expect(buildC2cListParams(filters(), 1, NOW)).toEqual({
      status: 'all',
      page: 1,
      per_page: 20,
    });
  });

  it('maps status, trimmed search and page', () => {
    expect(buildC2cListParams(filters({ status: 'pending', search: '  @ali ' }), 3, NOW)).toEqual({
      status: 'pending',
      search: '@ali',
      page: 3,
      per_page: 20,
    });
  });

  it('turns a period preset into date_from before now', () => {
    expect(buildC2cListParams(filters({ period: '24h' }), 1, NOW)).toEqual({
      status: 'all',
      date_from: '2026-09-11T12:00:00.000Z',
      page: 1,
      per_page: 20,
    });
    expect(buildC2cListParams(filters({ period: '7d' }), 1, NOW).date_from).toBe(
      '2026-09-05T12:00:00.000Z',
    );
    expect(buildC2cListParams(filters({ period: '30d' }), 1, NOW).date_from).toBe(
      '2026-08-13T12:00:00.000Z',
    );
  });

  it('makes a custom range cover the whole last day (date_to is exclusive)', () => {
    const params = buildC2cListParams(
      filters({ period: 'custom', dateFrom: '2026-09-01', dateTo: '2026-09-10' }),
      1,
      NOW,
    );
    expect(params.date_from).toBe(new Date(2026, 8, 1).toISOString());
    expect(params.date_to).toBe(new Date(2026, 8, 11).toISOString());
  });

  it('ignores empty custom dates', () => {
    const params = buildC2cListParams(filters({ period: 'custom' }), 1, NOW);
    expect(params.date_from).toBeUndefined();
    expect(params.date_to).toBeUndefined();
  });
});

describe('buildC2cStatsParams', () => {
  it('uses the same search and dates but no status, so every chip keeps its count', () => {
    expect(
      buildC2cStatsParams(filters({ status: 'approved', search: '#12', period: '24h' }), NOW),
    ).toEqual({
      search: '#12',
      date_from: '2026-09-11T12:00:00.000Z',
    });
  });
});

describe('isDefaultC2cFilters', () => {
  it('is true only with no search, all statuses and all time', () => {
    expect(isDefaultC2cFilters(filters())).toBe(true);
    expect(isDefaultC2cFilters(filters({ search: ' ' }))).toBe(true);
    expect(isDefaultC2cFilters(filters({ search: 'ali' }))).toBe(false);
    expect(isDefaultC2cFilters(filters({ status: 'pending' }))).toBe(false);
    expect(isDefaultC2cFilters(filters({ period: '7d' }))).toBe(false);
  });
});

describe('buildC2cApprovePayload', () => {
  it('sends no amount when the requested amount is credited', () => {
    expect(buildC2cApprovePayload(null)).toEqual({ ok: true, payload: {} });
  });

  it('converts a custom Toman amount to the wire scale', () => {
    expect(buildC2cApprovePayload('150000')).toEqual({
      ok: true,
      payload: { amount_kopeks: 15_000_000 },
    });
  });

  it('accepts Persian digits and thousands separators', () => {
    expect(buildC2cApprovePayload('۱۵۰,۰۰۰')).toEqual({
      ok: true,
      payload: { amount_kopeks: 15_000_000 },
    });
  });

  it('rejects an empty, zero or non-numeric custom amount', () => {
    for (const input of ['', '0', '-5', 'abc']) {
      expect(buildC2cApprovePayload(input)).toEqual({
        ok: false,
        errorKey: 'admin.c2cReceipts.detail.errors.enterAmount',
      });
    }
  });
});

describe('buildC2cRejectPayload', () => {
  it('sends the selected reason key', () => {
    expect(buildC2cRejectPayload('wrong_card', '')).toEqual({ reason_key: 'wrong_card' });
  });

  it('adds a trimmed comment when one was written', () => {
    expect(buildC2cRejectPayload('amt_mismatch', '  paid 90k ')).toEqual({
      reason_key: 'amt_mismatch',
      comment: 'paid 90k',
    });
  });

  it('refuses without a reason', () => {
    expect(buildC2cRejectPayload('', 'note')).toBeNull();
  });
});

describe('canDecideC2cReceipt', () => {
  it('needs a pending receipt and payments:edit', () => {
    expect(canDecideC2cReceipt('pending', true)).toBe(true);
    expect(canDecideC2cReceipt('pending', false)).toBe(false);
    for (const status of ['approved', 'rejected', 'expired', 'cancelled']) {
      expect(canDecideC2cReceipt(status, true)).toBe(false);
    }
  });
});
