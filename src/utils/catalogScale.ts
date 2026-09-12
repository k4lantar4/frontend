/** Catalog `*_kopeks` are stored ×100 vs Toman 1:1 `balance_kopeks`. */

export function catalogPriceInToman(priceKopeks: number): number {
  if (!Number.isFinite(priceKopeks)) return 0;
  return Math.trunc(priceKopeks / 100);
}

export function userCanAfford(balanceToman: number, priceKopeks: number): boolean {
  return (balanceToman || 0) >= catalogPriceInToman(priceKopeks);
}

export function missingToman(balanceToman: number, priceKopeks: number): number {
  const priceToman = catalogPriceInToman(priceKopeks);
  if (priceToman <= 0) return 0;
  return Math.max(0, priceToman - (balanceToman || 0));
}

/**
 * Toman → the catalog `*_kopeks` scale the cabinet API still expects on the wire.
 *
 * The mirror of {@link catalogPriceInToman}: admin forms ask the owner for Toman (the unit every
 * other screen uses) and convert here on save, instead of each form multiplying by 100 inline.
 */
export function tomanToCatalogKopeks(amountToman: number): number {
  if (!Number.isFinite(amountToman)) return 0;
  return Math.round(amountToman * 100);
}
