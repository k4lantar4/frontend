import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('i18next', () => ({
  default: { language: 'fa' },
}));

import { formatBalance, formatPrice, setExchangeRates, shouldSkipFxConversion } from './format';

describe('shouldSkipFxConversion', () => {
  it('skips FX for fa and ru (stored amounts are already display units)', () => {
    expect(shouldSkipFxConversion('fa')).toBe(true);
    expect(shouldSkipFxConversion('fa-IR')).toBe(true);
    expect(shouldSkipFxConversion('ru')).toBe(true);
  });

  it('still converts en and zh unless VITE_DISABLE_BALANCE_FX is set', () => {
    expect(shouldSkipFxConversion('en')).toBe(false);
    expect(shouldSkipFxConversion('zh')).toBe(false);
  });
});

describe('formatPrice toman skipFx', () => {
  beforeEach(() => {
    // Live RC rate was ~159 Toman/RUB (stored as RUB-per-IRR ≈ 0.00628).
    setExchangeRates({ USD: 100, CNY: 14, IRR: 0.00628 });
  });

  it('does not apply RUB to IRR FX for fa catalog prices', () => {
    // 1,000,000 kopeks → catalog display 10,000 Toman (÷100), not 10,000 / 0.00628 ≈ 1.59M.
    const rendered = formatPrice(1_000_000, 'fa');
    expect(rendered).not.toMatch(/1[59][\s,٬]?9/);
    expect(rendered.replace(/[^\d]/g, '')).toContain('10000');
  });
});

describe('formatBalance (Toman 1:1 wallet amounts)', () => {
  beforeEach(() => {
    setExchangeRates({ USD: 100, CNY: 14, IRR: 0.00628 });
  });

  it('shows a 50,000 Toman balance as 50,000 — never ÷100', () => {
    const rendered = formatBalance(50_000, 'fa');
    expect(rendered.replace(/[^\d]/g, '')).toBe('50000');
  });

  it('matches formatPrice of the same amount on the catalog scale', () => {
    // 1,000,000 Toman balance vs a 100,000,000-kopek (1,000,000 Toman) catalog price.
    expect(formatBalance(1_000_000, 'fa')).toBe(formatPrice(100_000_000, 'fa'));
  });
});
