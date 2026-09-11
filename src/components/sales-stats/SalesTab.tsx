import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { SalesStatsParams } from '../../api/adminSalesStats';
import { salesStatsApi } from '../../api/adminSalesStats';
import { SALES_STATS } from '../../constants/salesStats';
import { tomanOrLegacy } from '../../utils/balanceScale';
import { formatBalance } from '../../utils/format';
import { BanknotesIcon, CardIcon, TicketIcon, TrophyIcon } from '../../components/icons';
import { StatCard } from '../stats';

import { BreakdownList } from './BreakdownList';
import { DonutChart } from './DonutChart';
import { SimpleAreaChart } from './SimpleAreaChart';
import { StackedBarChart } from './StackedBarChart';
import { StatsTabSkeleton } from './StatsTabSkeleton';

interface SalesTabProps {
  params: SalesStatsParams;
}

export function SalesTab({ params }: SalesTabProps) {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-stats', 'sales', params],
    queryFn: () => salesStatsApi.getSales(params),
    staleTime: SALES_STATS.STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const dailyByTariffData = useMemo(
    () =>
      data?.daily_by_tariff.map((i) => ({ date: i.date, key: i.tariff_name, value: i.count })) ??
      [],
    [data?.daily_by_tariff],
  );

  if (isLoading) {
    return <StatsTabSkeleton />;
  }

  if (isError || !data) {
    return <div className="py-8 text-center text-error-400">{t('admin.salesStats.loadError')}</div>;
  }

  const tariffBreakdown = data.by_tariff.map((item) => ({
    key: String(item.tariff_id),
    label: item.tariff_name,
    value: item.count,
  }));

  const periodPieData = data.by_period.map((item) => ({
    name: `${item.period_days} ${t('admin.trafficUsage.days')}`,
    value: item.count,
  }));

  const dailyData = data.daily.map((item) => ({
    date: item.date,
    value: tomanOrLegacy(item.revenue_toman, item.revenue_kopeks, 'catalog'),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('admin.salesStats.sales.totalSales')}
          value={data.total_sales}
          icon={<TicketIcon className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label={t('admin.salesStats.sales.totalRevenue')}
          value={formatBalance(
            tomanOrLegacy(data.total_revenue_toman, data.total_revenue_kopeks, 'catalog'),
          )}
          icon={<BanknotesIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t('admin.salesStats.sales.avgOrder')}
          value={formatBalance(
            tomanOrLegacy(data.avg_order_toman, data.avg_order_kopeks, 'catalog'),
          )}
          icon={<CardIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t('admin.salesStats.sales.topTariff')}
          value={data.top_tariff_name}
          icon={<TrophyIcon className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownList title={t('admin.salesStats.sales.byTariff')} items={tariffBreakdown} />
        <DonutChart data={periodPieData} title={t('admin.salesStats.sales.byPeriod')} />
      </div>

      <SimpleAreaChart
        data={dailyData}
        title={t('admin.salesStats.sales.dailyChart')}
        chartId="sales-daily"
        valueLabel={t('admin.salesStats.summary.revenue')}
      />

      <StackedBarChart
        data={dailyByTariffData}
        title={t('admin.salesStats.sales.dailyByTariff')}
        valueFormatter={(v) => String(v)}
      />
    </div>
  );
}
