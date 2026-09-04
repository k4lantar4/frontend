import { describe, expect, it } from 'vitest';
import { getSubscriptionDisplayLabel } from './subscriptionDisplayLabel';

const t = (_key: string, fallback: string) => fallback;

describe('getSubscriptionDisplayLabel', () => {
  it('hides user_unknown prefix', () => {
    const label = getSubscriptionDisplayLabel(
      { tariff_name: 'Moon', panel_username: 'user_unknown_abc' },
      t,
    );
    expect(label).toBe('Moon');
    expect(label).not.toMatch(/user_unknown/);
  });

  it('uses panel username when real', () => {
    expect(
      getSubscriptionDisplayLabel({ tariff_name: 'Moon', panel_username: 'mobile_x_1001' }, t),
    ).toBe('mobile_x_1001');
  });
});
