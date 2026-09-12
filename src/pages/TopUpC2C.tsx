import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { balanceApi } from '../api/balance';
import { ticketsApi } from '../api/tickets';
import { useCloseOnSuccessNotification } from '../store/successNotification';
import { getApiErrorMessage } from '../utils/api-error';
import { catalogPriceInToman } from '../utils/catalogScale';
import {
  buildC2cReceiptPayload,
  C2C_IMAGE_TYPES,
  C2C_MAX_IMAGE_BYTES,
  C2C_POLL_INTERVAL_MS,
  c2cStepFor,
  checkC2cAmount,
  formatToman,
} from '../utils/c2cTopUp';
import type { C2cReceiptState, C2cSession } from '../types';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';
import { copyToClipboard } from '@/utils/clipboard';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { CardIcon, CheckIcon, CopyIcon, ExclamationIcon } from '@/components/icons';

const currentKey = (receiptId: number | null) => ['c2c-current', receiptId ?? 'pending'] as const;

const groupCardNumber = (number: string) =>
  number.replace(/\s+/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');

function sessionAsState(session: C2cSession): C2cReceiptState {
  return {
    ...session,
    has_receipt: false,
    approved_amount_toman: null,
    rejection_reason: null,
    created_at: new Date().toISOString(),
    processed_at: null,
  };
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await copyToClipboard(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard write failed silently
        }
      }}
      className={`shrink-0 rounded-lg p-2.5 transition-colors ${
        copied
          ? 'bg-success-500/20 text-success-400'
          : 'bg-dark-800/70 text-dark-400 hover:bg-dark-700 hover:text-dark-200'
      }`}
      title={copied ? t('balance.c2c.copied') : label}
      aria-label={label}
    >
      {copied ? <CheckIcon className="h-5 w-5" /> : <CopyIcon className="h-5 w-5" />}
    </button>
  );
}

export default function TopUpC2C() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The receipt this page follows. Null until a session exists; set from the pending receipt found
  // on mount, so polling keeps following it after it leaves "pending" (approved / rejected).
  const [trackedId, setTrackedId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });
  const method = methods?.find((m) => m.id === 'c2c');

  const { data: receipt, isLoading } = useQuery({
    queryKey: currentKey(trackedId),
    queryFn: () => balanceApi.c2cGetCurrent(trackedId ?? undefined),
    refetchInterval: (query) =>
      c2cStepFor(query.state.data) === 'pending' ? C2C_POLL_INTERVAL_MS : false,
  });
  const step = c2cStepFor(receipt);

  useEffect(() => {
    if (trackedId === null && receipt) {
      queryClient.setQueryData(currentKey(receipt.receipt_id), receipt);
      setTrackedId(receipt.receipt_id);
    }
  }, [trackedId, receipt, queryClient]);

  useEffect(() => {
    if (step === 'approved') {
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
  }, [step, queryClient]);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const goToBalance = useCallback(() => navigate('/balance', { replace: true }), [navigate]);
  // The approval also arrives over the websocket as a success modal; closing it leaves the page.
  useCloseOnSuccessNotification(goToBalance);

  const follow = (state: C2cReceiptState) => {
    queryClient.setQueryData(currentKey(state.receipt_id), state);
    setTrackedId(state.receipt_id);
  };

  const startMutation = useMutation({
    mutationFn: (amountKopeks: number) => balanceApi.c2cStartSession(amountKopeks),
    onSuccess: (session) => follow(sessionAsState(session)),
    onError: (err: unknown) => setError(getApiErrorMessage(err, t('common.error'))),
  });

  const submitMutation = useMutation({
    mutationFn: async (receiptId: number) => {
      const upload = file ? await ticketsApi.uploadMedia(file, 'photo') : null;
      const payload = buildC2cReceiptPayload(receiptId, upload, note);
      if (!payload) throw new Error(t('balance.c2c.errors.emptyReceipt'));
      return balanceApi.c2cSubmitReceipt(payload);
    },
    onSuccess: (state) => {
      setFile(null);
      setNote('');
      follow(state);
    },
    onError: (err: unknown) => setError(getApiErrorMessage(err, t('common.error'))),
  });

  const cancelMutation = useMutation({
    mutationFn: (receiptId: number) => balanceApi.c2cCancel(receiptId),
    onSuccess: () => startOver(),
    onError: (err: unknown) => setError(getApiErrorMessage(err, t('common.error'))),
  });

  const startOver = () => {
    setError(null);
    queryClient.setQueryData(currentKey(null), null);
    setTrackedId(null);
  };

  const handleStart = () => {
    setError(null);
    if (!method) return;
    const check = checkC2cAmount(amount, method);
    if (!check.ok) {
      setError(
        t(
          check.errorKey,
          check.params
            ? {
                min: formatToman(check.params.min),
                max: formatToman(check.params.max),
              }
            : undefined,
        ),
      );
      return;
    }
    startMutation.mutate(check.amountKopeks);
  };

  const handleFile = (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    if (!C2C_IMAGE_TYPES.includes(picked.type)) {
      setError(t('balance.c2c.errors.fileType'));
      return;
    }
    if (picked.size > C2C_MAX_IMAGE_BYTES) {
      setError(t('balance.c2c.errors.fileTooLarge'));
      return;
    }
    setFile(picked);
  };

  const handleSubmit = () => {
    setError(null);
    if (!receipt) return;
    if (!file && !note.trim()) {
      setError(t('balance.c2c.errors.emptyReceipt'));
      return;
    }
    submitMutation.mutate(receipt.receipt_id);
  };

  if (isLoading) {
    return (
      <SkeletonGroup className="space-y-3">
        <Skeleton variant="card" count={3} className="h-16" />
      </SkeletonGroup>
    );
  }

  const dateLocale = i18n.language?.startsWith('fa') ? 'fa-IR-u-nu-latn' : undefined;
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const minToman = method ? catalogPriceInToman(method.min_amount_kopeks) : 0;
  const maxToman = method ? catalogPriceInToman(method.max_amount_kopeks) : 0;
  const quickAmounts = (method?.quick_amounts ?? [])
    .map(catalogPriceInToman)
    .filter((value) => value >= minToman && value <= maxToman);

  const primaryButton =
    'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-500 font-bold text-on-accent transition-colors hover:bg-accent-400 active:bg-accent-600 disabled:cursor-not-allowed disabled:bg-dark-700 disabled:text-dark-500';
  const spinner = (
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );

  return (
    <motion.div
      className="mx-auto max-w-lg space-y-5"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={staggerItem} className="flex items-center gap-4 pb-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500/20 to-accent-600/20 text-accent-400">
          <div className="flex h-7 w-7 items-center justify-center">
            <CardIcon />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-dark-100">{t('balance.c2c.title')}</h3>
          {method && (
            <p className="text-sm text-dark-400">
              {t('balance.c2c.limits', { min: formatToman(minToman), max: formatToman(maxToman) })}
            </p>
          )}
        </div>
      </motion.div>

      {step === 'amount' && (
        <motion.div variants={staggerItem} className="space-y-3">
          <label htmlFor="c2c-amount" className="text-sm font-medium text-dark-400">
            {t('balance.c2c.amountTitle')}
          </label>
          <div className="relative rounded-2xl border border-dark-700/50 bg-dark-800/70">
            <input
              id="c2c-amount"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleStart();
                }
              }}
              placeholder="0"
              className="h-14 w-full bg-transparent px-4 text-xl font-bold text-dark-100 placeholder:text-dark-600 focus:outline-none"
              autoComplete="off"
            />
          </div>
          {quickAmounts.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className={`rounded-xl px-2 py-3 text-sm font-bold transition-colors ${
                    amount === String(value)
                      ? 'bg-accent-500/15 text-accent-400 ring-2 ring-accent-500/40'
                      : 'border border-dark-700/50 bg-dark-800/70 text-dark-200 hover:bg-dark-700/70'
                  }`}
                >
                  {formatToman(value)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={!method || startMutation.isPending || !amount.trim()}
            className={primaryButton}
          >
            {startMutation.isPending ? spinner : t('balance.c2c.continue')}
          </button>
        </motion.div>
      )}

      {step === 'transfer' && receipt && (
        <>
          <motion.div
            variants={staggerItem}
            className="space-y-4 rounded-2xl border border-dark-700/50 bg-dark-800/70 p-4"
          >
            <div className="font-semibold text-dark-100">{t('balance.c2c.transferTitle')}</div>
            {receipt.card_label && (
              <div className="text-sm text-dark-400">{receipt.card_label}</div>
            )}
            {receipt.card_number && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-dark-500">{t('balance.c2c.cardNumber')}</div>
                  <div
                    dir="ltr"
                    className="font-mono text-lg font-bold tracking-wider text-dark-100"
                  >
                    {groupCardNumber(receipt.card_number)}
                  </div>
                </div>
                <CopyButton value={receipt.card_number} label={t('balance.c2c.copy')} />
              </div>
            )}
            {receipt.card_holder && (
              <div>
                <div className="text-xs text-dark-500">{t('balance.c2c.cardHolder')}</div>
                <div className="font-semibold text-dark-100">{receipt.card_holder}</div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-dark-500">{t('balance.c2c.amount')}</div>
                <div className="text-lg font-bold text-accent-400">
                  {formatToman(receipt.amount_toman)} {t('balance.c2c.toman')}
                </div>
              </div>
              <CopyButton value={String(receipt.amount_toman)} label={t('balance.c2c.copy')} />
            </div>
            {receipt.guide_text && (
              <p className="whitespace-pre-line text-sm text-dark-400">{receipt.guide_text}</p>
            )}
            {receipt.expires_at && (
              <p className="text-xs text-dark-500">
                {t('balance.c2c.expiresAt', { time: formatDateTime(receipt.expires_at) })}
              </p>
            )}
          </motion.div>

          <motion.div variants={staggerItem} className="space-y-3">
            <div className="font-semibold text-dark-100">{t('balance.c2c.uploadTitle')}</div>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-dark-600 bg-dark-800/50 p-4 text-sm text-dark-300 hover:bg-dark-800">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="max-h-64 rounded-xl object-contain" />
              ) : null}
              <span>{file ? t('balance.c2c.changeImage') : t('balance.c2c.chooseImage')}</span>
              <input
                type="file"
                accept={C2C_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <label htmlFor="c2c-note" className="text-sm font-medium text-dark-400">
              {t('balance.c2c.noteLabel')}
            </label>
            <textarea
              id="c2c-note"
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('balance.c2c.notePlaceholder')}
              className="w-full rounded-xl border border-dark-700/50 bg-dark-800/70 p-3 text-sm text-dark-100 placeholder:text-dark-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitMutation.isPending || (!file && !note.trim())}
              className={primaryButton}
            >
              {submitMutation.isPending ? spinner : t('balance.c2c.submit')}
            </button>
            <button
              type="button"
              onClick={() => cancelMutation.mutate(receipt.receipt_id)}
              disabled={cancelMutation.isPending || submitMutation.isPending}
              className="w-full py-2 text-sm text-dark-400 hover:text-dark-200"
            >
              {t('balance.c2c.cancel')}
            </button>
          </motion.div>
        </>
      )}

      {step === 'pending' && receipt && (
        <motion.div
          variants={staggerItem}
          className="space-y-2 rounded-2xl border border-warning-500/20 bg-warning-500/10 p-4"
        >
          <div className="font-semibold text-warning-400">{t('balance.c2c.pendingTitle')}</div>
          <p className="text-sm text-dark-300">{t('balance.c2c.pendingMessage')}</p>
          <p className="text-sm text-dark-400">
            {t('balance.c2c.receiptNumber', { id: receipt.receipt_id })} ·{' '}
            {formatToman(receipt.amount_toman)} {t('balance.c2c.toman')}
          </p>
        </motion.div>
      )}

      {step === 'approved' && receipt && (
        <motion.div
          variants={staggerItem}
          className="space-y-3 rounded-2xl border border-success-500/20 bg-success-500/10 p-4"
        >
          <div className="flex items-center gap-2 font-semibold text-success-400">
            <CheckIcon className="h-5 w-5" />
            {t('balance.c2c.approvedTitle')}
          </div>
          <p className="text-sm text-dark-300">
            {t('balance.c2c.approvedMessage', {
              amount: formatToman(receipt.approved_amount_toman ?? receipt.amount_toman),
            })}
          </p>
          <button type="button" onClick={goToBalance} className={primaryButton}>
            {t('balance.c2c.backToBalance')}
          </button>
        </motion.div>
      )}

      {step === 'rejected' && receipt && (
        <motion.div
          variants={staggerItem}
          className="space-y-3 rounded-2xl border border-error-500/20 bg-error-500/10 p-4"
        >
          <div className="font-semibold text-error-400">{t('balance.c2c.rejectedTitle')}</div>
          <p className="text-sm text-dark-400">
            {t('balance.c2c.receiptNumber', { id: receipt.receipt_id })}
          </p>
          {receipt.rejection_reason && (
            <p className="text-sm text-dark-300">
              {t('balance.c2c.rejectedReason', { reason: receipt.rejection_reason })}
            </p>
          )}
          <button type="button" onClick={startOver} className={primaryButton}>
            {t('balance.c2c.retry')}
          </button>
        </motion.div>
      )}

      {error && (
        <motion.div
          variants={staggerItem}
          className="flex items-center gap-2 rounded-xl border border-error-500/20 bg-error-500/10 p-3"
        >
          <ExclamationIcon className="h-5 w-5 shrink-0 text-error-400" />
          <span className="text-sm text-error-400">{error}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
