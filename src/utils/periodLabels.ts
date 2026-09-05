type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Localized period chip/summary label. Falls back to nMonths / nDays. */
export function formatPeriodLabel(days: number, t: Translate): string {
  const key = `landing.periodLabels.d${days}`;
  const result = t(key);
  if (result !== key) return result;

  const months = Math.floor(days / 30);
  const remainder = days % 30;
  if (months > 0 && remainder === 0) {
    return t('landing.periodLabels.nMonths', { count: months });
  }
  return t('landing.periodLabels.nDays', { count: days });
}
