import { describe, expect, it } from 'vitest';
import { NEW_PURCHASE_PATH, isNewPurchaseIntent } from './purchaseRoutes';

describe('purchaseRoutes', () => {
  it('detects intent=new', () => {
    expect(isNewPurchaseIntent(new URLSearchParams('intent=new'))).toBe(true);
    expect(isNewPurchaseIntent(new URLSearchParams('subscriptionId=1'))).toBe(false);
    expect(NEW_PURCHASE_PATH).toContain('intent=new');
  });
});
