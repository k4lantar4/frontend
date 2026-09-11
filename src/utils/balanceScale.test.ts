import { describe, expect, it } from 'vitest';
import { balanceAmountFromDisplay, wsAmountToman } from './balanceScale';

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
