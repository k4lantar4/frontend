import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/uiLocale', () => ({ uiLocale: () => 'fa-IR-u-nu-latn' }));

import { formatKopeksToRubles, formatTomanAmount } from './utils';

describe('referral network amount formatting', () => {
  it('shows a Toman referral-earnings sum 1:1 — never ÷100', () => {
    expect(formatTomanAmount(50_000)).toBe('50,000');
    expect(formatTomanAmount(1_000_000)).toBe('1,000,000');
  });

  it('still divides a catalog-scale amount by 100', () => {
    expect(formatKopeksToRubles(5_000_000)).toBe('50,000');
  });
});
