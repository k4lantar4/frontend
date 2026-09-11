import { describe, expect, it } from 'vitest';
import { NEW_PURCHASE_PATH, isNewPurchaseIntent, switchTariffPath } from './purchaseRoutes';

describe('purchaseRoutes', () => {
  it('detects intent=new', () => {
    expect(isNewPurchaseIntent(new URLSearchParams('intent=new'))).toBe(true);
    expect(isNewPurchaseIntent(new URLSearchParams('subscriptionId=1'))).toBe(false);
    expect(NEW_PURCHASE_PATH).toContain('intent=new');
  });

  it('binds the tariff page to one subscription for a switch', () => {
    const path = switchTariffPath(42);
    const params = new URLSearchParams(path.split('?')[1]);
    expect(path.startsWith('/subscription/purchase?')).toBe(true);
    expect(params.get('subscriptionId')).toBe('42');
    expect(isNewPurchaseIntent(params)).toBe(false);
  });
});
