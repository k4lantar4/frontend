import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  canSwitchTariff,
  isSwitchBlockedByDirection,
  tariffSwitchErrorKey,
  type TariffSwitchContext,
} from './tariffSwitch';

const activePaid = { tariff_id: 2, is_trial: false, is_active: true, is_limited: false };

const ctx = (overrides: Partial<TariffSwitchContext> = {}): TariffSwitchContext => ({
  isNewPurchase: false,
  isMultiTariff: false,
  boundSubscriptionId: undefined,
  subscription: activePaid,
  isCurrentTariff: false,
  isSubscriptionExpired: false,
  isOnFreeTariff: false,
  targetOwned: false,
  switchAllowed: true,
  ...overrides,
});

describe('canSwitchTariff', () => {
  it('single-subscription mode: an active paid subscription can switch to another tariff', () => {
    expect(canSwitchTariff(ctx())).toBe(true);
  });

  it('multi-tariff mode: a page bound to an existing subscription offers switch', () => {
    expect(canSwitchTariff(ctx({ isMultiTariff: true, boundSubscriptionId: 42 }))).toBe(true);
  });

  it('multi-tariff mode: the unbound new-purchase page keeps «buy»', () => {
    expect(canSwitchTariff(ctx({ isMultiTariff: true, boundSubscriptionId: undefined }))).toBe(
      false,
    );
  });

  it('intent=new never switches, even with a subscription id in the URL', () => {
    expect(
      canSwitchTariff(ctx({ isNewPurchase: true, isMultiTariff: true, boundSubscriptionId: 42 })),
    ).toBe(false);
    expect(canSwitchTariff(ctx({ isNewPurchase: true }))).toBe(false);
  });

  it('multi-tariff mode: a tariff owned as another subscription is not a switch target', () => {
    expect(
      canSwitchTariff(ctx({ isMultiTariff: true, boundSubscriptionId: 42, targetOwned: true })),
    ).toBe(false);
  });

  it('keeps the existing exclusions: current, trial, expired, free source tariff', () => {
    const bound = { isMultiTariff: true, boundSubscriptionId: 42 };
    expect(canSwitchTariff(ctx({ ...bound, isCurrentTariff: true }))).toBe(false);
    expect(
      canSwitchTariff(ctx({ ...bound, subscription: { ...activePaid, is_trial: true } })),
    ).toBe(false);
    expect(canSwitchTariff(ctx({ ...bound, isSubscriptionExpired: true }))).toBe(false);
    expect(canSwitchTariff(ctx({ ...bound, isOnFreeTariff: true }))).toBe(false);
  });

  it('needs a subscription on a tariff that is active or limited', () => {
    expect(canSwitchTariff(ctx({ subscription: null }))).toBe(false);
    expect(canSwitchTariff(ctx({ subscription: { ...activePaid, tariff_id: null } }))).toBe(false);
    expect(
      canSwitchTariff(
        ctx({ subscription: { ...activePaid, is_active: false, is_limited: false } }),
      ),
    ).toBe(false);
    expect(
      canSwitchTariff(ctx({ subscription: { ...activePaid, is_active: false, is_limited: true } })),
    ).toBe(true);
  });
});

describe('switch direction (F-001)', () => {
  it('a tariff the bot would refuse by direction is not switchable', () => {
    expect(canSwitchTariff(ctx({ switchAllowed: false }))).toBe(false);
  });

  it('is hidden only when the direction is the one thing blocking the switch', () => {
    expect(isSwitchBlockedByDirection(ctx({ switchAllowed: false }))).toBe(true);
    expect(isSwitchBlockedByDirection(ctx())).toBe(false);
  });

  it('a card that goes to purchase anyway stays visible', () => {
    const blocked = { switchAllowed: false };
    expect(isSwitchBlockedByDirection(ctx({ ...blocked, isSubscriptionExpired: true }))).toBe(
      false,
    );
    expect(isSwitchBlockedByDirection(ctx({ ...blocked, isNewPurchase: true }))).toBe(false);
    expect(isSwitchBlockedByDirection(ctx({ ...blocked, isCurrentTariff: true }))).toBe(false);
    expect(isSwitchBlockedByDirection(ctx({ ...blocked, isOnFreeTariff: true }))).toBe(false);
  });
});

const apiError = (status: number, detail: unknown) =>
  new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { detail },
  });

describe('tariffSwitchErrorKey', () => {
  it('409: the target tariff is already owned as another subscription', () => {
    expect(
      tariffSwitchErrorKey(
        apiError(409, 'You already have an active subscription for the target tariff'),
      ),
    ).toBe('subscription.switchTariff.errors.alreadyOwned');
  });

  it('403: switch direction disabled by the admin', () => {
    expect(tariffSwitchErrorKey(apiError(403, 'Понижение тарифа недоступно'))).toBe(
      'subscription.switchTariff.errors.downgradeDisabled',
    );
    expect(tariffSwitchErrorKey(apiError(403, 'Повышение тарифа недоступно'))).toBe(
      'subscription.switchTariff.errors.upgradeDisabled',
    );
  });

  it('403: direction refusal sent as a code', () => {
    expect(
      tariffSwitchErrorKey(
        apiError(403, {
          code: 'tariff_downgrade_disabled',
          message: 'Tariff downgrade is disabled',
        }),
      ),
    ).toBe('subscription.switchTariff.errors.downgradeDisabled');
    expect(
      tariffSwitchErrorKey(
        apiError(403, { code: 'tariff_upgrade_disabled', message: 'Tariff upgrade is disabled' }),
      ),
    ).toBe('subscription.switchTariff.errors.upgradeDisabled');
  });

  it('other 403s: the tariff is not available to this user', () => {
    expect(tariffSwitchErrorKey(apiError(403, 'Tariff not available for your promo group'))).toBe(
      'subscription.switchTariff.errors.notAvailable',
    );
  });

  it('leaves everything else to the generic error text', () => {
    expect(tariffSwitchErrorKey(apiError(400, 'Already on this tariff'))).toBeNull();
    expect(tariffSwitchErrorKey(new Error('boom'))).toBeNull();
    expect(tariffSwitchErrorKey(undefined)).toBeNull();
  });
});
