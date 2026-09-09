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
