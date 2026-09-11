import { useCallback, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { SalesStatsParams } from '../../api/adminSalesStats';
import { salesStatsApi } from '../../api/adminSalesStats';
import { METHOD_LABELS } from '../../constants/paymentMethods';
import { SALES_STATS } from '../../constants/salesStats';
import { tomanOrLegacy } from '../../utils/balanceScale';
import { formatBalance } from '../../utils/format';
import { BanknotesIcon, CardIcon, WalletIcon } from '../../components/icons';
import { StatCard } from '../stats';

import PaymentMethodIcon from '../PaymentMethodIcon';

import { BreakdownList } from './BreakdownList';
import { SimpleAreaChart } from './SimpleAreaChart';
import { StackedBarChart } from './StackedBarChart';
import { StatsTabSkeleton } from './StatsTabSkeleton';

interface DepositsTabProps {
  params: SalesStatsParams;
}

export function DepositsTab({ params }: DepositsTabProps) {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-stats', 'deposits', params],
    queryFn: () => salesStatsApi.getDeposits(params),
    staleTime: SALES_STATS.STALE_TIME,
    placeholderData: keepPreviousData,
  });

  const formatValue = useCallback((v: number) => formatBalance(v), []);

  const methodBreakdown = useMemo(
    () =>
      data?.by_method.map((item) => ({
        key: item.method,
        label: METHOD_LABELS[item.method] || item.method,
        value: tomanOrLegacy(item.amount_toman, item.amount_kopeks, 'catalog'),
        icon: <PaymentMethodIcon method={item.method} className="h-5 w-5 shrink-0" />,
      })) ?? [],
    [data?.by_method],
  );

  const dailyData = useMemo(
    () =>
      data?.daily.map((item) => ({
        date: item.date,
        value: tomanOrLegacy(item.amount_toman, item.amount_kopeks, 'catalog'),
      })) ?? [],
    [data?.daily],
  );

  const dailyByMethodData = useMemo(
    () =>
      data?.daily_by_method.map((i) => ({
        date: i.date,
        key: METHOD_LABELS[i.method] || i.method,
        value: tomanOrLegacy(i.amount_toman, i.amount_kopeks, 'catalog'),
      })) ?? [],
    [data?.daily_by_method],
  );

  if (isLoading) {
    return <StatsTabSkeleton />;
  }

  if (isError || !data) {
    return <div className="py-8 text-center text-error-400">{t('admin.salesStats.loadError')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={t('admin.salesStats.deposits.totalDeposits')}
          value={data.total_deposits}
          icon={<WalletIcon className="h-5 w-5" />}
          tone="accent"
        />
        <StatCard
          label={t('admin.salesStats.deposits.totalAmount')}
          value={formatBalance(
            tomanOrLegacy(data.total_amount_toman, data.total_amount_kopeks, 'catalog'),
          )}
          icon={<BanknotesIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label={t('admin.salesStats.deposits.avgDeposit')}
          value={formatBalance(
            tomanOrLegacy(data.avg_deposit_toman, data.avg_deposit_kopeks, 'catalog'),
          )}
          icon={<CardIcon className="h-5 w-5" />}
          tone="neutral"
        />
      </div>

      <BreakdownList
        title={t('admin.salesStats.deposits.byMethod')}
        items={methodBreakdown}
        valueFormatter={formatValue}
      />

      <SimpleAreaChart
        data={dailyData}
        title={t('admin.salesStats.deposits.dailyChart')}
        chartId="deposits-daily"
        valueLabel={t('admin.salesStats.deposits.revenue')}
      />

      <StackedBarChart
        data={dailyByMethodData}
        title={t('admin.salesStats.deposits.dailyByMethod')}
        valueFormatter={formatValue}
      />
    </div>
  );
}
