import { useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { AdminBackButton, backTo } from '@/components/admin';
import { useDestructiveConfirm, useNotify } from '@/platform';
import { usePermissionStore } from '@/store/permissions';
import {
  adminC2cReceiptsApi,
  c2cReceiptKeys,
  type C2cApprovePayload,
  type C2cReceiptAdminDetail,
  type C2cRejectPayload,
} from '../api/adminC2cReceipts';
import { ticketsApi } from '../api/tickets';
import {
  buildC2cApprovePayload,
  buildC2cRejectPayload,
  canDecideC2cReceipt,
} from '../utils/adminC2cReceipts';
import { getApiErrorMessage } from '../utils/api-error';
import { catalogPriceInToman } from '../utils/catalogScale';
import { formatBalance } from '../utils/format';
import { formatUserDateTime } from '../utils/formatDate';
import { C2cStatusBadge } from './AdminC2cReceipts';

type Decision =
  | { kind: 'approve'; payload: C2cApprovePayload }
  | { kind: 'reject'; payload: C2cRejectPayload };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 text-sm">
      <span className="text-dark-500">{label}</span>
      <span className="text-dark-100">{children}</span>
    </div>
  );
}

function ReceiptMedia({ receipt }: { receipt: C2cReceiptAdminDetail }) {
  const { t } = useTranslation();
  if (!receipt.receipt_media_file_id) {
    return receipt.receipt_text ? null : (
      <p className="text-sm text-dark-400">{t('admin.c2cReceipts.detail.noReceipt')}</p>
    );
  }
  const url = ticketsApi.getMediaUrl(receipt.receipt_media_file_id, receipt.receipt_media_token);
  if (receipt.receipt_type === 'photo') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={t('admin.c2cReceipts.detail.openFullSize')}
      >
        <img
          src={url}
          alt={t('admin.c2cReceipts.detail.receipt')}
          className="max-h-96 w-full rounded-lg bg-dark-800 object-contain"
          loading="lazy"
        />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex">
      {t('admin.c2cReceipts.detail.openFile')}
    </a>
  );
}

export default function AdminC2cReceiptDetail() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { receiptId: receiptIdParam } = useParams<{ receiptId: string }>();
  const receiptId = Number(receiptIdParam);
  const queryClient = useQueryClient();
  const notify = useNotify();
  const confirm = useDestructiveConfirm();
  const canEdit = usePermissionStore((state) => state.hasPermission('payments:edit'));

  const [mode, setMode] = useState<'idle' | 'amount' | 'reject'>('idle');
  const [customAmount, setCustomAmount] = useState('');
  const [reasonKey, setReasonKey] = useState('');
  const [comment, setComment] = useState('');

  const {
    data: receipt,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: c2cReceiptKeys.detail(receiptId),
    queryFn: () => adminC2cReceiptsApi.get(receiptId),
    enabled: Number.isFinite(receiptId),
  });

  const canDecide = receipt ? canDecideC2cReceipt(receipt.status, canEdit) : false;

  const { data: reasons } = useQuery({
    queryKey: c2cReceiptKeys.rejectReasons,
    queryFn: adminC2cReceiptsApi.rejectReasons,
    enabled: !!receipt && (canDecide || !!receipt.rejection_reason_key),
    staleTime: 10 * 60 * 1000,
  });

  const decision = useMutation({
    mutationFn: (action: Decision) =>
      action.kind === 'approve'
        ? adminC2cReceiptsApi.approve(receiptId, action.payload)
        : adminC2cReceiptsApi.reject(receiptId, action.payload),
    onSuccess: (updated, action) => {
      queryClient.setQueryData(c2cReceiptKeys.detail(receiptId), updated);
      queryClient.invalidateQueries({ queryKey: c2cReceiptKeys.all });
      setMode('idle');
      notify.success(
        t(
          action.kind === 'approve'
            ? 'admin.c2cReceipts.detail.approved'
            : 'admin.c2cReceipts.detail.rejected',
        ),
      );
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Decided in the Telegram group meanwhile: show who decided it, not our stale state.
        notify.error(t('admin.c2cReceipts.detail.alreadyDecided'));
        setMode('idle');
        // Invalidating the prefix refetches this detail too, plus the list and its counts.
        queryClient.invalidateQueries({ queryKey: c2cReceiptKeys.all });
        return;
      }
      notify.error(getApiErrorMessage(error, t('admin.c2cReceipts.detail.actionFailed')));
    },
  });

  const approve = async (customInput: string | null) => {
    if (!receipt) return;
    const built = buildC2cApprovePayload(customInput);
    if (!built.ok) {
      notify.error(t(built.errorKey));
      return;
    }
    const creditToman =
      built.payload.amount_kopeks === undefined
        ? receipt.amount_toman
        : catalogPriceInToman(built.payload.amount_kopeks);
    const ok = await confirm(
      t('admin.c2cReceipts.detail.confirmApprove', { amount: formatBalance(creditToman) }),
      t('admin.c2cReceipts.detail.approve'),
    );
    if (ok) decision.mutate({ kind: 'approve', payload: built.payload });
  };

  const submitReject = () => {
    const payload = buildC2cRejectPayload(reasonKey, comment);
    if (payload) decision.mutate({ kind: 'reject', payload });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div className="space-y-4">
        <AdminBackButton to="/admin/c2c-receipts" />
        <div className="card py-12 text-center">
          <div className="text-dark-400">{t('admin.c2cReceipts.detail.notFound')}</div>
          <button onClick={() => refetch()} className="btn-secondary mt-3">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { user, reviewer } = receipt;
  const busy = decision.isPending;
  const actionsDisabled = !canDecide || busy;
  const reasonLabel = (code: string | null) =>
    code ? (reasons?.find((reason) => reason.code === code)?.label ?? code) : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AdminBackButton to="/admin/c2c-receipts" />
        <h1 className="text-xl font-bold text-dark-100">
          {t('admin.c2cReceipts.detail.title', { id: receipt.id })}
        </h1>
        <C2cStatusBadge status={receipt.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="text-2xl font-semibold text-dark-50">
            {formatBalance(receipt.amount_toman)}
          </div>
          <div className="divide-y divide-dark-700/40">
            {receipt.approved_amount_toman != null && (
              <Field label={t('admin.c2cReceipts.detail.credited')}>
                {formatBalance(receipt.approved_amount_toman)}
              </Field>
            )}
            {receipt.card_label && (
              <Field label={t('admin.c2cReceipts.detail.card')}>{receipt.card_label}</Field>
            )}
            {receipt.card_number_masked && (
              <Field label={t('admin.c2cReceipts.detail.cardNumber')}>
                <span dir="ltr" className="font-mono">
                  {receipt.card_number_masked}
                </span>
              </Field>
            )}
            <Field label={t('admin.c2cReceipts.detail.created')}>
              {formatUserDateTime(receipt.created_at, i18n.language)}
            </Field>
            {receipt.expires_at && receipt.status === 'pending' && (
              <Field label={t('admin.c2cReceipts.detail.expires')}>
                {formatUserDateTime(receipt.expires_at, i18n.language)}
              </Field>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-dark-300">
              {t('admin.c2cReceipts.detail.receipt')}
            </h2>
            <ReceiptMedia receipt={receipt} />
            {receipt.receipt_text && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-dark-500">
                  {t('admin.c2cReceipts.detail.receiptText')}
                </div>
                <p className="whitespace-pre-wrap rounded-lg bg-dark-800/60 p-3 text-sm text-dark-100">
                  {receipt.receipt_text}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-dark-300">
                {t('admin.c2cReceipts.detail.user')}
              </h2>
              <Link
                to={`/admin/users/${user.id}`}
                state={backTo(location).state}
                className="text-sm text-accent-400 hover:underline"
              >
                {t('admin.c2cReceipts.detail.openUser')}
              </Link>
            </div>
            <div className="divide-y divide-dark-700/40">
              {(user.username || user.full_name) && (
                <Field label={t('admin.c2cReceipts.detail.user')}>
                  {[user.full_name, user.username && `@${user.username}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Field>
              )}
              {user.telegram_id && (
                <Field label={t('admin.c2cReceipts.detail.telegramId')}>{user.telegram_id}</Field>
              )}
              {user.email && (
                <Field label={t('admin.c2cReceipts.detail.email')}>{user.email}</Field>
              )}
              <Field label={t('admin.c2cReceipts.detail.balance')}>
                {formatBalance(receipt.user_balance_toman)}
              </Field>
            </div>
          </div>

          {receipt.status !== 'pending' && (
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-dark-300">
                {t('admin.c2cReceipts.detail.decision')}
              </h2>
              <div className="divide-y divide-dark-700/40">
                {reviewer.label && (
                  <Field label={t('admin.c2cReceipts.detail.reviewedBy')}>
                    {reviewer.label}
                    {reviewer.via && ` (${t(`admin.c2cReceipts.via.${reviewer.via}`)})`}
                  </Field>
                )}
                {receipt.processed_at && (
                  <Field label={t('admin.c2cReceipts.detail.processed')}>
                    {formatUserDateTime(receipt.processed_at, i18n.language)}
                  </Field>
                )}
                {receipt.rejection_reason_key && (
                  <Field label={t('admin.c2cReceipts.detail.rejectionReason')}>
                    {reasonLabel(receipt.rejection_reason_key)}
                  </Field>
                )}
                {/* The bot stores the reason key itself here; only a real admin comment is shown. */}
                {receipt.rejection_reason &&
                  receipt.rejection_reason !== receipt.rejection_reason_key && (
                    <Field label={t('admin.c2cReceipts.detail.adminComment')}>
                      {receipt.rejection_reason}
                    </Field>
                  )}
                {receipt.transaction_id != null && (
                  <Field label={t('admin.c2cReceipts.detail.transaction')}>
                    #{receipt.transaction_id}
                  </Field>
                )}
              </div>
            </div>
          )}

          <div className="card space-y-3">
            {receipt.status !== 'pending' ? (
              <p className="text-sm text-dark-400">
                {t('admin.c2cReceipts.detail.decided', {
                  status: t(`admin.c2cReceipts.status.${receipt.status}`),
                })}
              </p>
            ) : (
              !canEdit && (
                <p className="text-sm text-dark-400">{t('admin.c2cReceipts.detail.readOnly')}</p>
              )
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => approve(null)}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('admin.c2cReceipts.detail.approve')}
              </button>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => {
                  setCustomAmount(String(receipt.amount_toman));
                  setMode('amount');
                }}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('admin.c2cReceipts.detail.approveOther')}
              </button>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => setMode('reject')}
                className="btn-secondary text-error-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('admin.c2cReceipts.detail.reject')}
              </button>
            </div>

            {canDecide && mode === 'amount' && (
              <div className="space-y-2 rounded-xl border border-dark-700 p-3">
                <label htmlFor="c2c-approve-amount" className="block text-xs text-dark-400">
                  {t('admin.c2cReceipts.detail.amountLabel')}
                </label>
                <input
                  id="c2c-approve-amount"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-dark-100 focus:border-accent-500 focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approve(customAmount)}
                    className="btn-primary disabled:opacity-50"
                  >
                    {t('admin.c2cReceipts.detail.approveWithAmount')}
                  </button>
                  <button type="button" onClick={() => setMode('idle')} className="btn-secondary">
                    {t('admin.c2cReceipts.detail.cancel')}
                  </button>
                </div>
              </div>
            )}

            {canDecide && mode === 'reject' && (
              <div className="space-y-3 rounded-xl border border-dark-700 p-3">
                <fieldset>
                  <legend className="mb-2 text-xs text-dark-400">
                    {t('admin.c2cReceipts.detail.reasonLabel')}
                  </legend>
                  <div className="space-y-1.5">
                    {reasons?.map((reason) => (
                      <label
                        key={reason.code}
                        className="flex cursor-pointer items-center gap-2 text-sm text-dark-100"
                      >
                        <input
                          type="radio"
                          name="c2c-reject-reason"
                          value={reason.code}
                          checked={reasonKey === reason.code}
                          onChange={() => setReasonKey(reason.code)}
                        />
                        {reason.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label htmlFor="c2c-reject-comment" className="mb-1 block text-xs text-dark-400">
                    {t('admin.c2cReceipts.detail.commentLabel')}
                  </label>
                  <textarea
                    id="c2c-reject-comment"
                    value={comment}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 focus:border-accent-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !reasonKey}
                    onClick={submitReject}
                    className="btn-primary bg-error-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('admin.c2cReceipts.detail.confirmReject')}
                  </button>
                  <button type="button" onClick={() => setMode('idle')} className="btn-secondary">
                    {t('admin.c2cReceipts.detail.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
