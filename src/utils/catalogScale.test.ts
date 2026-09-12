import { describe, expect, it } from 'vitest';
import {
  catalogPriceInToman,
  missingToman,
  tomanToCatalogKopeks,
  userCanAfford,
} from './catalogScale';

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

  it('converts Toman back to the catalog wire scale', () => {
    expect(tomanToCatalogKopeks(7_000)).toBe(700_000);
    expect(tomanToCatalogKopeks(10_000)).toBe(1_000_000);
  });

  it('round-trips a Toman amount typed in an admin form', () => {
    expect(catalogPriceInToman(tomanToCatalogKopeks(12_345))).toBe(12_345);
  });

  it('rounds fractional Toman and falls back to 0 for non-numbers', () => {
    expect(tomanToCatalogKopeks(0.5)).toBe(50);
    expect(tomanToCatalogKopeks(Number.NaN)).toBe(0);
    expect(tomanToCatalogKopeks(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
