import axios from 'axios';
import type { Subscription } from '../types';

/**
 * Everything the tariff grid knows when it decides between «تغییر» (switch this
 * subscription to the tariff) and «خرید» (buy the tariff).
 */
export interface TariffSwitchContext {
  /** `?intent=new` — the page buys an additional subscription. */
  isNewPurchase: boolean;
  isMultiTariff: boolean;
  /** `?subscriptionId=N` — the page acts on that existing subscription. */
  boundSubscriptionId: number | undefined;
  subscription:
    | (Pick<Subscription, 'is_trial' | 'is_active' | 'is_limited'> & {
        tariff_id?: number | null;
      })
    | null;
  isCurrentTariff: boolean;
  isSubscriptionExpired: boolean;
  /** 0-price source tariff: the bot refuses the prorated switch (free_tariff_cannot_switch). */
  isOnFreeTariff: boolean;
  /** The user already owns the target tariff as another alive subscription (`is_purchased`). */
  targetOwned: boolean;
}

/**
 * Fork change vs upstream bedolaga-cabinet bcbfa419, which never switches in
 * multi-tariff mode: here a page bound to an existing subscription switches it,
 * as the bot does. The unbound page still buys, so an extra subscription can be
 * bought.
 */
export function canSwitchTariff(c: TariffSwitchContext): boolean {
  if (c.isNewPurchase) return false;
  if (c.isMultiTariff && (c.boundSubscriptionId == null || c.targetOwned)) return false;
  const sub = c.subscription;
  if (!sub?.tariff_id) return false;
  if (c.isCurrentTariff || sub.is_trial || c.isSubscriptionExpired || c.isOnFreeTariff) {
    return false;
  }
  return sub.is_active || sub.is_limited;
}

// The bot sends these refusals as plain (non-localized) detail strings.
const DOWNGRADE_DISABLED_DETAIL = 'Понижение тарифа недоступно';
const UPGRADE_DISABLED_DETAIL = 'Повышение тарифа недоступно';

/**
 * i18n key for a tariff-switch preview/switch refusal the bot sends without a
 * readable message, or null to fall back to the generic error text.
 */
export function tariffSwitchErrorKey(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const status = error.response?.status;
  const detail: unknown = error.response?.data?.detail;
  if (status === 409) return 'subscription.switchTariff.errors.alreadyOwned';
  if (status === 403) {
    if (detail === DOWNGRADE_DISABLED_DETAIL)
      return 'subscription.switchTariff.errors.downgradeDisabled';
    if (detail === UPGRADE_DISABLED_DETAIL)
      return 'subscription.switchTariff.errors.upgradeDisabled';
    return 'subscription.switchTariff.errors.notAvailable';
  }
  return null;
}
