import { describe, expect, it } from 'vitest';
import { balanceAmountFromDisplay, tomanOrLegacy, wsAmountToman } from './balanceScale';

describe('wsAmountToman', () => {
  it('prefers the display amount the bot already computed', () => {
    expect(wsAmountToman(50_000, 50_000, 'balance')).toBe(50_000);
    expect(wsAmountToman(50_000, 5_000_000, 'catalog')).toBe(50_000);
  });

  it('reads a balance-scale raw amount 1:1 when no display amount is sent', () => {
    // A 50,000 Toman C2C top-up: amount_kopeks carries Toman, not kopeks.
    expect(wsAmountToman(undefined, 50_000, 'balance')).toBe(50_000);
    expect(wsAmountToman(null, 1_000_000, 'balance')).toBe(1_000_000);
  });

  it('divides a catalog-scale raw amount by 100 when no display amount is sent', () => {
    // A subscription_payment of 5,000,000 kopeks is 50,000 Toman.
    expect(wsAmountToman(undefined, 5_000_000, 'catalog')).toBe(50_000);
  });

  it('falls back to 0 when neither amount is present', () => {
    expect(wsAmountToman(undefined, undefined, 'balance')).toBe(0);
    expect(wsAmountToman(null, null, 'catalog')).toBe(0);
  });
});

describe('balanceAmountFromDisplay', () => {
  it('sends a typed Toman amount 1:1 — never ×100', () => {
    expect(balanceAmountFromDisplay(50_000)).toBe(50_000);
    expect(balanceAmountFromDisplay(1_000_000)).toBe(1_000_000);
  });

  it('rounds to whole Toman and rejects non-finite input', () => {
    expect(balanceAmountFromDisplay(50_000.4)).toBe(50_000);
    expect(balanceAmountFromDisplay(Number.NaN)).toBe(0);
  });
});

describe('tomanOrLegacy', () => {
  it('uses the bot *_toman field as-is when present (remnabot#40)', () => {
    // Sales summary mixing a 50,000 Toman deposit and a 1,000,000 catalog
    // subscription_payment: the bot sends 60,000; the raw *_kopeks sum is 1,050,000.
    expect(tomanOrLegacy(60_000, 1_050_000, 'catalog')).toBe(60_000);
    expect(tomanOrLegacy(50_000, 50_000, 'balance')).toBe(50_000);
  });

  it('keeps a zero *_toman instead of falling back', () => {
    expect(tomanOrLegacy(0, 1_000_000, 'catalog')).toBe(0);
  });

  it('falls back to the legacy field on its old scale for an older bot', () => {
    // subscription_payment total 1,000,000 kopeks → 10,000 Toman.
    expect(tomanOrLegacy(undefined, 1_000_000, 'catalog')).toBe(10_000);
    expect(tomanOrLegacy(null, 1_000_000, 'catalog')).toBe(10_000);
    // A Toman 1:1 legacy field (e.g. ReferralEarning sum) stays 1:1.
    expect(tomanOrLegacy(undefined, 50_000, 'balance')).toBe(50_000);
  });

  it('returns 0 for missing or non-finite amounts', () => {
    expect(tomanOrLegacy(undefined, undefined, 'catalog')).toBe(0);
    expect(tomanOrLegacy(Number.NaN, Number.NaN, 'balance')).toBe(0);
  });
});
