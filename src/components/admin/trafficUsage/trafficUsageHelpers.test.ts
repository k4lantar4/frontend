import { describe, it, expect } from 'vitest';
import { formatCompactToman } from './trafficUsageHelpers';
import { tomanOrLegacy } from '@/utils/balanceScale';

describe('formatCompactToman', () => {
  it('prints small amounts as whole Toman', () => {
    expect(formatCompactToman(0)).toBe('0');
    expect(formatCompactToman(999)).toBe('999');
  });

  it('abbreviates thousands', () => {
    expect(formatCompactToman(1_200)).toBe('1.2k');
    expect(formatCompactToman(50_000)).toBe('50.0k');
  });

  it('survives a missing value', () => {
    expect(formatCompactToman(Number.NaN)).toBe('0');
  });
});

describe('traffic-usage "spent" column', () => {
  // remnabot revision 0115 made total_spent a plain Toman sum; the ÷100 the old helper did showed
  // 1/100 of the real amount. The bot sends the twin, and only an older bot omits it.
  const spent = (data: { total_spent_toman?: number; total_spent_kopeks: number }) =>
    formatCompactToman(tomanOrLegacy(data.total_spent_toman, data.total_spent_kopeks, 'catalog'));

  it('reads the Toman twin when the bot sends it', () => {
    expect(spent({ total_spent_toman: 50_000, total_spent_kopeks: 50_000 })).toBe('50.0k');
  });

  it('falls back to the catalog reading of the legacy field', () => {
    expect(spent({ total_spent_kopeks: 5_000_000 })).toBe('50.0k');
  });
});
