// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import type { C2cReceiptAdminItem, C2cReceiptListResponse } from '@/api/adminC2cReceipts';
import { formatBalance } from '@/utils/format';

/**
 * The receipt list is the owner's review queue. It must ask the API for exactly the filters on
 * screen, and print the amount from `amount_toman` through the Toman formatter — `amount_kopeks`
 * is the x100 wire value and would show a receipt 100 times too large.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const list = vi.fn();
const stats = vi.fn();

vi.mock('@/api/adminC2cReceipts', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/adminC2cReceipts')>('@/api/adminC2cReceipts');
  return {
    ...actual,
    adminC2cReceiptsApi: {
      ...actual.adminC2cReceiptsApi,
      list: (params: unknown) => list(params),
      stats: (params: unknown) => stats(params),
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

// The lazy page import and jsdom role queries are slow on a busy machine.
const SLOW = { timeout: 5000 };
const TEST_TIMEOUT = 20000;

const receipt = (over: Partial<C2cReceiptAdminItem> = {}): C2cReceiptAdminItem => ({
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
  ...over,
});

const page = (items: C2cReceiptAdminItem[]): C2cReceiptListResponse => ({
  items,
  total: items.length,
  page: 1,
  per_page: 20,
  pages: 1,
});

afterEach(cleanup);
beforeEach(() => {
  list.mockReset();
  stats.mockReset();
  stats.mockResolvedValue({
    total: 3,
    pending: 1,
    approved: 1,
    rejected: 1,
    expired: 0,
    cancelled: 0,
  });
});

async function renderList() {
  const AdminC2cReceipts = (await import('./AdminC2cReceipts')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/admin/c2c-receipts']}>
          <AdminC2cReceipts />
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

describe('C2C receipt list', () => {
  it(
    'maps the status chip and the search box to query params',
    async () => {
      list.mockResolvedValue(page([receipt()]));
      await renderList();

      await waitFor(
        () => expect(list).toHaveBeenCalledWith({ status: 'all', page: 1, per_page: 20 }),
        SLOW,
      );

      // Anchored: the receipt row is a button too, and it also contains the "pending" badge.
      fireEvent.click(
        await screen.findByRole(
          'button',
          { name: /^admin\.c2cReceipts\.status\.pending\d*$/ },
          SLOW,
        ),
      );
      await waitFor(
        () => expect(list).toHaveBeenLastCalledWith({ status: 'pending', page: 1, per_page: 20 }),
        SLOW,
      );

      fireEvent.change(screen.getByPlaceholderText('admin.c2cReceipts.searchPlaceholder'), {
        target: { value: '@ali' },
      });
      await waitFor(
        () =>
          expect(list).toHaveBeenLastCalledWith({
            status: 'pending',
            search: '@ali',
            page: 1,
            per_page: 20,
          }),
        SLOW,
      );
      expect(stats).toHaveBeenLastCalledWith({ search: '@ali' });
    },
    TEST_TIMEOUT,
  );

  it(
    'prints amount_toman with the Toman formatter, never amount_kopeks',
    async () => {
      list.mockResolvedValue(page([receipt()]));
      await renderList();

      // The formatter uses non-breaking spaces; testing-library normalizes the DOM text only.
      const shown = (amount: number) => formatBalance(amount).replace(/\s+/g, ' ');
      expect(await screen.findByText('#41', {}, SLOW)).toBeTruthy();
      expect(screen.getByText(shown(123_456))).toBeTruthy();
      expect(screen.queryByText(shown(12_345_600))).toBeNull();
    },
    TEST_TIMEOUT,
  );

  it(
    'renders the empty state for no receipts',
    async () => {
      list.mockResolvedValue(page([]));
      await renderList();

      expect(await screen.findByText('admin.c2cReceipts.empty', {}, SLOW)).toBeTruthy();
    },
    TEST_TIMEOUT,
  );
});
