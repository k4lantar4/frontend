export interface DailyStatItem {
  date: string;
  referrals_count: number;
  earnings_kopeks: number;
  /** Display Toman (remnabot#40, admin and partner chart data alike). */
  earnings_toman?: number;
}

export interface PeriodStats {
  days: number;
  referrals_count: number;
  earnings_kopeks: number;
  earnings_toman?: number;
}

export interface PeriodChange {
  absolute: number;
  percent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PeriodComparison {
  current: PeriodStats;
  previous: PeriodStats;
  referrals_change: PeriodChange;
  earnings_change: PeriodChange;
}
