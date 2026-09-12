import { useTranslation } from 'react-i18next';
import type { C2cReceiptState } from '../types';
import { formatToman, isC2cAwaitingReview } from '../utils/c2cTopUp';

interface C2cPendingBannerProps {
  receipt: C2cReceiptState | null | undefined;
  onOpen: () => void;
}

/** Balance-screen notice for a card-to-card receipt the owner has not decided on yet. */
export default function C2cPendingBanner({ receipt, onOpen }: C2cPendingBannerProps) {
  const { t } = useTranslation();
  if (!receipt || !isC2cAwaitingReview(receipt)) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-warning-500/20 bg-warning-500/10 p-4"
    >
      <span className="text-sm text-warning-400">
        {t('balance.c2c.pendingBanner', {
          id: receipt.receipt_id,
          amount: formatToman(receipt.amount_toman),
        })}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-lg bg-warning-500/20 px-3 py-1.5 text-sm font-semibold text-warning-400 transition-colors hover:bg-warning-500/30"
      >
        {t('balance.c2c.pendingBannerAction')}
      </button>
    </div>
  );
}
