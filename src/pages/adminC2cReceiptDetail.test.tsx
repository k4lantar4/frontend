// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { C2cReceiptAdminDetail } from '@/api/adminC2cReceipts';

/**
 * Approving a receipt credits real balance. The detail screen must send exactly the decision the
 * admin made — no `amount_kopeks` unless another amount was typed, the reason key that was picked —
 * and must not offer a decision on a receipt that is already decided or to an admin without
 * payments:edit. A 409 means the other channel (the Telegram group) decided it meanwhile: the
 * screen refetches rather than pretending its stale state is current.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const notifications: { success: string[]; error: string[] } = { success: [], error: [] };

vi.mock('@/platform', async () => {
  const actual = await vi.importActual<typeof import('@/platform')>('@/platform');
  return {
    ...actual,
    useNotify: () => ({
      success: (message: string) => notifications.success.push(message),
      error: (message: string) => notifications.error.push(message),
      info: () => {},
      warning: () => {},
    }),
    useDestructiveConfirm: () => () => Promise.resolve(true),
  };
});

const granted = new Set<string>();

vi.mock('@/store/permissions', () => ({
  usePermissionStore: (selector: (state: unknown) => unknown) =>
    selector({
      hasPermission: (perm: string) => granted.has(perm),
      hasAnyPermission: (...perms: string[]) => perms.some((p) => granted.has(p)),
      hasAllPermissions: (...perms: string[]) => perms.every((p) => granted.has(p)),
    }),
}));

const get = vi.fn();
const approve = vi.fn();
const reject = vi.fn();

vi.mock('@/api/adminC2cReceipts', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/adminC2cReceipts')>('@/api/adminC2cReceipts');
  return {
    ...actual,
    adminC2cReceiptsApi: {
      ...actual.adminC2cReceiptsApi,
      get: (id: number) => get(id),
      approve: (id: number, payload: unknown) => approve(id, payload),
      reject: (id: number, payload: unknown) => reject(id, payload),
      rejectReasons: () =>
        Promise.resolve([
          { code: 'amt_mismatch', label: 'Amount mismatch' },
          { code: 'wrong_card', label: 'Wrong card' },
        ]),
    },
  };
});

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

(globalThis as Record<string, unknown>).__APP_VERSION__ ??= '0.0.0-test';

const SLOW = { timeout: 5000 };
const TEST_TIMEOUT = 20000;

const detail = (over: Partial<C2cReceiptAdminDetail> = {}): C2cReceiptAdminDetail => ({
  id: 41,
  status: 'pending',
  amount_kopeks: 12_345_600,
  amount_toman: 123_456,
  approved_amount_toman: null,
  card_label: 'Melli',
  receipt_type: 'photo',
  has_receipt: true,
  created_at: '2026-09-12T10:00:00Z',
  processed_at: null,
  expires_at: '2026-09-13T10:00:00Z',
  user: { id: 7, telegram_id: 555, username: 'ali', full_name: 'Ali R', email: null },
  reviewer: { user_id: null, telegram_id: null, label: null, via: null },
  rejection_reason_key: null,
  rejection_reason: null,
  receipt_media_file_id: 'file-1',
  receipt_media_token: 'tok',
  receipt_text: null,
  transaction_id: null,
  user_balance_toman: 5_000,
  card_number_masked: '**** 1234',
  ...over,
});

afterEach(cleanup);
beforeEach(() => {
  get.mockReset();
  approve.mockReset();
  reject.mockReset();
  granted.clear();
  notifications.success.length = 0;
  notifications.error.length = 0;
});

async function renderDetail() {
  const AdminC2cReceiptDetail = (await import('./AdminC2cReceiptDetail')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/admin/c2c-receipts/41']}>
          <Routes>
            <Route path="/admin/c2c-receipts/:receiptId" element={<AdminC2cReceiptDetail />} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

const button = (key: string) =>
  screen.findByRole('button', { name: `admin.c2cReceipts.detail.${key}` }, SLOW);

describe('C2C receipt detail', () => {
  it(
    'approves the requested amount without amount_kopeks',
    async () => {
      granted.add('payments:edit');
      get.mockResolvedValue(detail());
      approve.mockResolvedValue(detail({ status: 'approved' }));
      await renderDetail();

      fireEvent.click(await button('approve'));

      await waitFor(() => expect(approve).toHaveBeenCalledWith(41, {}), SLOW);
      await waitFor(() =>
        expect(notifications.success).toContain('admin.c2cReceipts.detail.approved'),
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'sends a custom amount on the wire scale',
    async () => {
      granted.add('payments:edit');
      get.mockResolvedValue(detail());
      approve.mockResolvedValue(detail({ status: 'approved' }));
      await renderDetail();

      fireEvent.click(await button('approveOther'));
      fireEvent.change(screen.getByLabelText('admin.c2cReceipts.detail.amountLabel'), {
        target: { value: '150000' },
      });
      fireEvent.click(await button('approveWithAmount'));

      await waitFor(
        () => expect(approve).toHaveBeenCalledWith(41, { amount_kopeks: 15_000_000 }),
        SLOW,
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'rejects with the selected reason key',
    async () => {
      granted.add('payments:edit');
      get.mockResolvedValue(detail());
      reject.mockResolvedValue(detail({ status: 'rejected' }));
      await renderDetail();

      fireEvent.click(await button('reject'));
      expect((await button('confirmReject')).hasAttribute('disabled')).toBe(true);
      fireEvent.click(await screen.findByRole('radio', { name: 'Wrong card' }, SLOW));
      fireEvent.click(await button('confirmReject'));

      await waitFor(
        () => expect(reject).toHaveBeenCalledWith(41, { reason_key: 'wrong_card' }),
        SLOW,
      );
      expect(approve).not.toHaveBeenCalled();
    },
    TEST_TIMEOUT,
  );

  it(
    'disables the actions for a decided receipt',
    async () => {
      granted.add('payments:edit');
      get.mockResolvedValue(
        detail({
          status: 'approved',
          reviewer: { user_id: 1, telegram_id: null, label: 'owner', via: 'cabinet' },
        }),
      );
      await renderDetail();

      for (const key of ['approve', 'approveOther', 'reject']) {
        expect((await button(key)).hasAttribute('disabled')).toBe(true);
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'disables the actions without payments:edit',
    async () => {
      get.mockResolvedValue(detail());
      await renderDetail();

      for (const key of ['approve', 'approveOther', 'reject']) {
        expect((await button(key)).hasAttribute('disabled')).toBe(true);
      }
      expect(screen.getByText('admin.c2cReceipts.detail.readOnly')).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  it(
    'refetches the receipt when the other channel decided it first (409)',
    async () => {
      granted.add('payments:edit');
      get.mockResolvedValueOnce(detail());
      get.mockResolvedValue(detail({ status: 'rejected' }));
      approve.mockRejectedValue(
        new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { detail: 'This receipt has already been reviewed.' },
        }),
      );
      await renderDetail();

      fireEvent.click(await button('approve'));

      await waitFor(() => expect(get).toHaveBeenCalledTimes(2), SLOW);
      expect(notifications.error).toContain('admin.c2cReceipts.detail.alreadyDecided');
    },
    TEST_TIMEOUT,
  );
});
