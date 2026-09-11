/** Catalog purchase without binding to an existing subscription (multi-tariff buyAnother). */
export const NEW_PURCHASE_PATH = '/subscription/purchase?intent=new';

export function isNewPurchaseIntent(searchParams: URLSearchParams): boolean {
  return searchParams.get('intent') === 'new';
}

/** Tariff page bound to an existing subscription: other tariffs switch it (multi-tariff too). */
export function switchTariffPath(subscriptionId: number): string {
  return `/subscription/purchase?subscriptionId=${subscriptionId}`;
}
