import { describe, expect, it } from 'vitest';
import { catalogPriceInToman, missingToman, userCanAfford } from './catalogScale';

describe('catalogScale', () => {
  it('converts catalog kopeks to Toman', () => {
    expect(catalogPriceInToman(700_000)).toBe(7_000);
    expect(catalogPriceInToman(1_000_000)).toBe(10_000);
  });

  it('treats 426,800 Toman as enough for a 7,000 Toman plan', () => {
    expect(userCanAfford(426_800, 700_000)).toBe(true);
    expect(missingToman(426_800, 700_000)).toBe(0);
  });

  it('computes Toman shortfall without mixing scales', () => {
    expect(userCanAfford(4_268, 700_000)).toBe(false);
    expect(missingToman(4_268, 700_000)).toBe(2_732);
  });
});
