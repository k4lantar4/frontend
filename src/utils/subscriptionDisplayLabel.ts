export type SubscriptionLabelSource = {
  tariff_name?: string | null;
  panel_username?: string | null;
  account_sequence?: number | null;
};

const USER_UNKNOWN_PREFIX = 'user_unknown_';

export function getSubscriptionDisplayLabel(
  sub: SubscriptionLabelSource,
  t: (key: string, fallback: string) => string,
  isMultiTariff = false,
): string {
  let panel = (sub.panel_username ?? '').trim();
  if (panel.startsWith(USER_UNKNOWN_PREFIX)) {
    panel = '';
  }
  if (panel) return panel;

  const defaultName = t('subscription.defaultName', 'Подписка');
  if (isMultiTariff && sub.account_sequence) {
    return `${sub.tariff_name || defaultName} #${sub.account_sequence}`;
  }
  return sub.tariff_name || defaultName;
}
