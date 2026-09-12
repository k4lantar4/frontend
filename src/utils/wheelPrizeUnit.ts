export type WheelPrizeValueUnit = 'currency' | 'days' | 'gb';

/**
 * Unit shown next to a wheel prize's «value» field in the admin form.
 * `promocode` has none: its reward comes from the promo fields (balance bonus,
 * subscription days), not from `prize_value`. `nothing` and unknown types too.
 */
export function wheelPrizeValueUnit(prizeType: string): WheelPrizeValueUnit | null {
  switch (prizeType) {
    case 'balance_bonus':
      return 'currency';
    case 'subscription_days':
      return 'days';
    case 'traffic_gb':
      return 'gb';
    default:
      return null;
  }
}
