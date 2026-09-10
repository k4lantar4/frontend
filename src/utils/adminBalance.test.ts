import { describe, expect, it } from 'vitest';
import { activityAmountToman, adminBalanceUpdatePayload, paymentsTotalToman } from './adminBalance';

describe('paymentsTotalToman', () => {
  it('uses the backend Toman total (C2C deposits are 1:1)', () => {
    expect(paymentsTotalToman(1_052_000, 1_250_000)).toBe(1_052_000);
  });

  it('falls back to the legacy kopeks sum on older backends', () => {
    expect(paymentsTotalToman(undefined, 1_000_000)).toBe(10_000);
  });
});

describe('adminBalanceUpdatePayload', () => {
  it('sends the typed Toman as amount_display for a top-up', () => {
    expect(adminBalanceUpdatePayload(200_000, true, 'مفتی')).toEqual({
      amount_display: 200_000,
      description: 'مفتی',
    });
  });

  it('sends a negative amount_display for a deduction', () => {
    expect(adminBalanceUpdatePayload(50_000, false, 'کسر')).toEqual({
      amount_display: -50_000,
      description: 'کسر',
    });
  });

  it('never multiplies by 100', () => {
    const payload = adminBalanceUpdatePayload(1_000_000, true, 'x');
    expect(payload.amount_display).toBe(1_000_000);
    expect('amount_kopeks' in payload).toBe(false);
  });

  it('uses the absolute value of the typed number', () => {
    expect(adminBalanceUpdatePayload(-20_000, true, 'x').amount_display).toBe(20_000);
  });
});

describe('activityAmountToman', () => {
  it('prefers the backend amount_toman (deposit is Toman 1:1)', () => {
    expect(activityAmountToman({ amount_kopeks: 50_000, amount_toman: 50_000 })).toBe(50_000);
  });

  it('keeps catalog-scale amounts from amount_toman', () => {
    expect(activityAmountToman({ amount_kopeks: -1_000_000, amount_toman: -10_000 })).toBe(-10_000);
  });

  it('falls back to the legacy catalog reading when amount_toman is absent', () => {
    expect(activityAmountToman({ amount_kopeks: 1_000_000 })).toBe(10_000);
    expect(activityAmountToman({ amount_kopeks: 1_000_000, amount_toman: null })).toBe(10_000);
  });

  it('returns null when there is no amount', () => {
    expect(activityAmountToman({ amount_kopeks: null })).toBeNull();
  });
});
