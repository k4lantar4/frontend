import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminBackButton, backTo } from '@/components/admin';
import { CalendarIcon, CheckCircleIcon, RefreshIcon, SearchIcon } from '@/components/icons';
import {
  adminC2cReceiptsApi,
  c2cReceiptKeys,
  type C2cReceiptAdminItem,
  type C2cReceiptStats,
  type C2cStatusFilter,
} from '../api/adminC2cReceipts';
import { DateField } from '../components/DateField';
import {
  buildC2cListParams,
  buildC2cStatsParams,
  DEFAULT_C2C_FILTERS,
  isDefaultC2cFilters,
  type C2cPeriod,
  type C2cReceiptFilters,
} from '../utils/adminC2cReceipts';
import { formatBalance } from '../utils/format';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-500/20 text-warning-400',
  approved: 'bg-success-500/20 text-success-400',
  rejected: 'bg-error-500/20 text-error-400',
  expired: 'bg-dark-700/50 text-dark-300',
  cancelled: 'bg-dark-700/50 text-dark-300',
};

export function C2cStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-dark-700/50 text-dark-300'}`}
    >
      {t(`admin.c2cReceipts.status.${status}`)}
    </span>
  );
}

const STATUS_FILTERS: C2cStatusFilter[] = [
  'all',
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled',
];
const PERIODS: Exclude<C2cPeriod, 'custom'>[] = ['all', '24h', '7d', '30d'];

function statusCount(stats: C2cReceiptStats | undefined, status: C2cStatusFilter) {
  if (!stats) return null;
  return status === 'all' ? stats.total : stats[status];
}

function ReceiptRow({ receipt, onOpen }: { receipt: C2cReceiptAdminItem; onOpen: () => void }) {
  const { t } = useTranslation();
  const { user, reviewer } = receipt;
  const userName = user.username ? `@${user.username}` : user.full_name;
  const userContact = user.telegram_id ? `TG: ${user.telegram_id}` : user.email;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-xl border border-dark-700/30 bg-dark-800/30 p-4 text-start transition-colors hover:border-dark-600"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-accent-400">#{receipt.id}</span>
            <C2cStatusBadge status={receipt.status} />
            {!receipt.has_receipt && (
              <span className="text-xs text-dark-500">{t('admin.c2cReceipts.noReceipt')}</span>
            )}
          </div>
          <div className="text-lg font-semibold text-dark-50">
            {formatBalance(receipt.amount_toman)}
          </div>
          {receipt.approved_amount_toman != null &&
            receipt.approved_amount_toman !== receipt.amount_toman && (
              <div className="text-sm text-success-400">
                {t('admin.c2cReceipts.credited', {
                  amount: formatBalance(receipt.approved_amount_toman),
                })}
              </div>
            )}
          <div className="mt-1 text-sm text-dark-400">
            <span className="text-dark-500">{t('admin.c2cReceipts.user')}:</span>{' '}
            <span className="text-dark-200">{userName || `#${user.id}`}</span>
            {userContact && <span className="text-dark-400"> &middot; {userContact}</span>}
          </div>
          {receipt.card_label && (
            <div className="mt-1 text-sm text-dark-400">
              <span className="text-dark-500">{t('admin.c2cReceipts.card')}:</span>{' '}
              {receipt.card_label}
            </div>
          )}
        </div>
        <div className="space-y-1 text-end text-xs text-dark-500">
          <div>
            {t('admin.c2cReceipts.created')}: {new Date(receipt.created_at).toLocaleString()}
          </div>
          {receipt.processed_at && (
            <div>
              {t('admin.c2cReceipts.processed')}: {new Date(receipt.processed_at).toLocaleString()}
            </div>
          )}
          {reviewer.label && (
            <div className="text-dark-400">
              {t('admin.c2cReceipts.reviewedBy', { name: reviewer.label })}
              {reviewer.via && ` (${t(`admin.c2cReceipts.via.${reviewer.via}`)})`}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function AdminC2cReceipts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<C2cReceiptFilters>(DEFAULT_C2C_FILTERS);
  const [page, setPage] = useState(1);

  const updateFilters = (patch: Partial<C2cReceiptFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchInput === filters.search) return;
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  const listParams = buildC2cListParams(filters, page);
  const statsParams = buildC2cStatsParams(filters);
  const refetchInterval = isDefaultC2cFilters(filters) ? 30000 : false;

  const {
    data: receipts,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    // Preset periods move with the clock; key on the filters, not the computed timestamps.
    queryKey: [...c2cReceiptKeys.all, 'list', filters, page],
    queryFn: () => adminC2cReceiptsApi.list(listParams),
    refetchInterval,
  });

  const { data: stats } = useQuery({
    queryKey: [...c2cReceiptKeys.all, 'stats', { ...filters, status: 'all' }],
    queryFn: () => adminC2cReceiptsApi.stats(statsParams),
    refetchInterval,
  });

  const handleResetSearch = () => {
    setSearchInput('');
    updateFilters({ search: '' });
  };

  const chipClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm transition-all ${
      active ? 'bg-accent-500 text-on-accent' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
    }`;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AdminBackButton />
          <div>
            <h1 className="text-xl font-bold text-dark-100">{t('admin.c2cReceipts.title')}</h1>
            <p className="text-sm text-dark-400">{t('admin.c2cReceipts.description')}</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2">
          <RefreshIcon className="h-4 w-4" />
          {t('common.refresh')}
        </button>
      </div>

      <div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-dark-500">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('admin.c2cReceipts.searchPlaceholder')}
            className="w-full rounded-xl border border-dark-700 bg-dark-800 py-3 pe-4 ps-10 text-dark-100 placeholder-dark-500 transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <p className="mt-1.5 text-xs text-dark-500">{t('admin.c2cReceipts.searchHint')}</p>
      </div>

      {filters.search && (
        <div className="flex items-center justify-between rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-3">
          <span className="text-sm text-accent-300">
            {t('admin.c2cReceipts.searchResults', {
              query: filters.search,
              count: receipts?.total ?? 0,
            })}
          </span>
          <button
            onClick={handleResetSearch}
            className="ms-3 rounded-lg px-3 py-1 text-sm text-accent-400 transition-colors hover:bg-accent-500/20"
          >
            {t('admin.c2cReceipts.resetSearch')}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((status) => {
            const count = statusCount(stats, status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => updateFilters({ status })}
                className={`flex items-center gap-1.5 ${chipClass(filters.status === status)}`}
              >
                {t(`admin.c2cReceipts.status.${status}`)}
                {count != null && (
                  <span className="rounded-full bg-black/20 px-1.5 text-xs">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => updateFilters({ period })}
              className={chipClass(filters.period === period)}
            >
              {t(`admin.c2cReceipts.period.${period}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ period: 'custom' })}
            className={`flex items-center gap-1.5 ${chipClass(filters.period === 'custom')}`}
          >
            <CalendarIcon className="h-4 w-4" />
            {t('admin.c2cReceipts.period.custom')}
          </button>
        </div>
      </div>

      {filters.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-accent-500/30 bg-accent-500/5 p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-dark-400">
              {t('admin.c2cReceipts.dateFrom')}
            </label>
            <DateField
              value={filters.dateFrom}
              max={filters.dateTo}
              onChange={(dateFrom) => updateFilters({ dateFrom })}
              className="flex w-full items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 transition-colors hover:border-accent-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-dark-400">
              {t('admin.c2cReceipts.dateTo')}
            </label>
            <DateField
              value={filters.dateTo}
              min={filters.dateFrom}
              onChange={(dateTo) => updateFilters({ dateTo })}
              className="flex w-full items-center gap-2 rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 transition-colors hover:border-accent-500"
            />
          </div>
        </div>
      )}

      <div className="card">
        {isError ? (
          <div className="py-12 text-center">
            <div className="text-dark-400">{t('common.error')}</div>
            <button onClick={() => refetch()} className="btn-secondary mt-3">
              {t('common.retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
          </div>
        ) : receipts && receipts.items.length > 0 ? (
          <div className="space-y-3">
            {receipts.items.map((receipt) => (
              <ReceiptRow
                key={receipt.id}
                receipt={receipt}
                onOpen={() => navigate(`/admin/c2c-receipts/${receipt.id}`, backTo(location))}
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800">
              <CheckCircleIcon className="h-8 w-8 text-dark-500" />
            </div>
            <div className="text-dark-400">{t('admin.c2cReceipts.empty')}</div>
          </div>
        )}

        {receipts && receipts.pages > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-dark-500">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={receipts.page <= 1}
              className="btn-secondary min-w-[100px] flex-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:text-sm"
            >
              {t('admin.c2cReceipts.prev')}
            </button>
            <div className="flex-1 text-center">
              {t('admin.c2cReceipts.page', { current: receipts.page, total: receipts.pages })}
            </div>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(receipts.pages, prev + 1))}
              disabled={receipts.page >= receipts.pages}
              className="btn-secondary min-w-[100px] flex-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:text-sm"
            >
              {t('admin.c2cReceipts.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
