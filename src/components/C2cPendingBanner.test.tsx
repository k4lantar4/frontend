// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { C2cReceiptState } from '../types';

import faLocale from '@/locales/fa.json';

/**
 * The balance screen tells the user a card-to-card receipt is still under review. It must not
 * appear for a transfer the user has not sent a receipt for yet (that is not "under review"), nor
 * after the decision, and the amount is the Toman 1:1 field — never the x100 wire field.
 */

function resolveFa(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], faLocale);
  return typeof value === 'string' ? value : undefined;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = resolveFa(key) ?? key;
      return template.replace(/{{(\w+)}}/g, (_m, name) => String(options?.[name] ?? ''));
    },
    i18n: { language: 'fa' },
  }),
}));

const state = (over: Partial<C2cReceiptState> = {}): C2cReceiptState => ({
  receipt_id: 7,
  status: 'pending',
  has_receipt: true,
  amount_kopeks: 25_000_000,
  amount_toman: 250_000,
  approved_amount_toman: null,
  rejection_reason: null,
  card_label: 'Melli',
  card_number: null,
  card_holder: null,
  guide_text: null,
  created_at: '2026-09-12T10:00:00Z',
  expires_at: null,
  processed_at: null,
  ...over,
});

afterEach(cleanup);

async function renderBanner(receipt: C2cReceiptState | null, onOpen = () => {}) {
  const { default: C2cPendingBanner } = await import('./C2cPendingBanner');
  return render(<C2cPendingBanner receipt={receipt} onOpen={onOpen} />);
}

describe('C2cPendingBanner', () => {
  it('announces a receipt under review with its number and Toman amount', async () => {
    await renderBanner(state());

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('7');
    expect(banner.textContent).toContain('250,000');
    expect(banner.textContent).not.toContain('25,000,000');
    expect(banner.textContent).toContain('در انتظار بررسی');
  });

  it('stays hidden while the transfer has no receipt yet', async () => {
    const { container } = await renderBanner(state({ has_receipt: false }));
    expect(container.firstChild).toBeNull();
  });

  it('stays hidden after the decision and when nothing is pending', async () => {
    const approved = await renderBanner(state({ status: 'approved' }));
    expect(approved.container.firstChild).toBeNull();
    cleanup();
    const none = await renderBanner(null);
    expect(none.container.firstChild).toBeNull();
  });

  it('links back to the card-to-card page', async () => {
    const onOpen = vi.fn();
    await renderBanner(state(), onOpen);

    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
