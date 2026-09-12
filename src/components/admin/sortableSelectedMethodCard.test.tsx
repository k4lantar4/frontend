// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminLandingPaymentMethod } from '@/api/landings';

/**
 * The landing editor's per-method min/max limits are seeded from — and sent back to — the admin
 * payment-methods API, which still speaks the frozen wire scale (Toman x100). The card used to
 * show and write that raw number under a unit-less «حداقل مبلغ» label, so an owner typing a Toman
 * limit stored it 100x too small (FINDINGS F-075). It now converts at the form edge, exactly like
 * AdminPaymentMethodEdit.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

import { SortableSelectedMethodCard } from './SortableSelectedMethodCard';

afterEach(cleanup);

const method: AdminLandingPaymentMethod & { _id: string } = {
  _id: 'card-1',
  method_id: 'c2c',
  display_name: 'Card to card',
  description: null,
  icon_url: null,
  sort_order: 0,
  min_amount_kopeks: 5_000_000,
  max_amount_kopeks: 100_000_000,
  currency: null,
  return_url: null,
  sub_options: null,
};

function renderCard(overrides: Partial<typeof method> = {}) {
  const onUpdate = vi.fn();
  render(
    <SortableSelectedMethodCard
      method={{ ...method, ...overrides }}
      availableSubOptions={null}
      onUpdate={onUpdate}
      onSubOptionsChange={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText('Card to card'));
  const min = screen.getByLabelText('Min amount (Toman)') as HTMLInputElement;
  const max = screen.getByLabelText('Max amount (Toman)') as HTMLInputElement;
  return { onUpdate, min, max };
}

describe('SortableSelectedMethodCard payment limits', () => {
  it('shows the stored wire amounts as Toman', () => {
    const { min, max } = renderCard();
    expect(min.value).toBe('50000');
    expect(max.value).toBe('1000000');
  });

  it('writes a typed Toman amount back on the wire scale', () => {
    const { onUpdate, min } = renderCard();
    fireEvent.change(min, { target: { value: '25000' } });
    expect(onUpdate).toHaveBeenCalledWith('c2c', 'min_amount_kopeks', 2_500_000);
  });

  it('keeps an empty limit null instead of zero', () => {
    const { onUpdate, max } = renderCard();
    fireEvent.change(max, { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledWith('c2c', 'max_amount_kopeks', null);
  });

  it('renders an unset limit as an empty field', () => {
    const { min } = renderCard({ min_amount_kopeks: null });
    expect(min.value).toBe('');
  });
});
