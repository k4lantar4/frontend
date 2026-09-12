import { describe, expect, it } from 'vitest';
import { wheelPrizeValueUnit } from './wheelPrizeUnit';

describe('wheelPrizeValueUnit', () => {
  it('uses the currency for balance bonuses', () => {
    expect(wheelPrizeValueUnit('balance_bonus')).toBe('currency');
  });

  it('uses days for subscription days', () => {
    expect(wheelPrizeValueUnit('subscription_days')).toBe('days');
  });

  it('uses GB only for traffic prizes', () => {
    expect(wheelPrizeValueUnit('traffic_gb')).toBe('gb');
  });

  it('has no unit for promocode prizes (the value is not a quantity)', () => {
    expect(wheelPrizeValueUnit('promocode')).toBeNull();
  });

  it('has no unit for nothing or an unknown type', () => {
    expect(wheelPrizeValueUnit('nothing')).toBeNull();
    expect(wheelPrizeValueUnit('something_new')).toBeNull();
  });
});
