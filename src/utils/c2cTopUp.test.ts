import { describe, expect, it } from 'vitest';
import type { C2cReceiptState, PaymentMethod } from '../types';
import {
  buildC2cReceiptPayload,
  c2cStepFor,
  checkC2cAmount,
  isC2cAwaitingReview,
} from './c2cTopUp';

/**
 * The card-to-card page is a small state machine driven by what the server reports about the
 * user's receipt. Getting a step wrong is not cosmetic: showing the card again for a receipt that
 * is already under review invites a second transfer, and the amount leaves on the x100 wire scale.
 */

const state = (over: Partial<C2cReceiptState> = {}): C2cReceiptState => ({
  receipt_id: 7,
  status: 'pending',
  has_receipt: false,
  amount_kopeks: 10_000_000,
  amount_toman: 100_000,
  approved_amount_toman: null,
  rejection_reason: null,
  card_label: 'Melli',
  card_number: '6037000000000001',
  card_holder: 'Ali',
  guide_text: 'Send the exact amount.',
  created_at: '2026-09-12T10:00:00Z',
  expires_at: '2026-09-13T10:00:00Z',
  processed_at: null,
  ...over,
});

// Live limits: 100,000 – 10,000,000 Toman, on the wire x100.
const method: Pick<PaymentMethod, 'min_amount_kopeks' | 'max_amount_kopeks'> = {
  min_amount_kopeks: 10_000_000,
  max_amount_kopeks: 1_000_000_000,
};

describe('c2cStepFor', () => {
  it('starts at the amount when nothing is in progress', () => {
    expect(c2cStepFor(null)).toBe('amount');
    expect(c2cStepFor(undefined)).toBe('amount');
  });

  it('shows the card while the transfer is still due', () => {
    expect(c2cStepFor(state())).toBe('transfer');
  });

  it('never shows the card again once a receipt is attached', () => {
    expect(c2cStepFor(state({ has_receipt: true }))).toBe('pending');
  });

  it('reports the decision', () => {
    expect(c2cStepFor(state({ status: 'approved', has_receipt: true }))).toBe('approved');
    expect(c2cStepFor(state({ status: 'rejected', has_receipt: true }))).toBe('rejected');
  });

  it('starts over after an expired or cancelled transfer', () => {
    expect(c2cStepFor(state({ status: 'expired' }))).toBe('amount');
    expect(c2cStepFor(state({ status: 'cancelled' }))).toBe('amount');
  });
});

describe('checkC2cAmount', () => {
  it('sends a Toman amount on the x100 wire scale', () => {
    expect(checkC2cAmount('100000', method)).toEqual({ ok: true, amountKopeks: 10_000_000 });
  });

  it('accepts Persian digits and thousands separators as typed', () => {
    expect(checkC2cAmount('۲۵۰,۰۰۰', method)).toEqual({ ok: true, amountKopeks: 25_000_000 });
    expect(checkC2cAmount(' 250٬000 ', method)).toEqual({ ok: true, amountKopeks: 25_000_000 });
  });

  it('names the limits in Toman, not on the wire scale', () => {
    expect(checkC2cAmount('99999', method)).toEqual({
      ok: false,
      errorKey: 'balance.c2c.errors.amountRange',
      params: { min: 100_000, max: 10_000_000 },
    });
    expect(checkC2cAmount('10000001', method)).toMatchObject({ ok: false });
  });

  it('asks for an amount when the field is empty or not a number', () => {
    expect(checkC2cAmount('', method)).toEqual({
      ok: false,
      errorKey: 'balance.c2c.errors.enterAmount',
    });
    expect(checkC2cAmount('abc', method)).toMatchObject({
      errorKey: 'balance.c2c.errors.enterAmount',
    });
    expect(checkC2cAmount('0', method)).toMatchObject({
      errorKey: 'balance.c2c.errors.enterAmount',
    });
  });
});

describe('buildC2cReceiptPayload', () => {
  it('sends the uploaded image and the note together', () => {
    expect(
      buildC2cReceiptPayload(7, { file_id: 'AgACfile', media_type: 'photo' }, '  paid 10:30 '),
    ).toEqual({
      receipt_id: 7,
      media_file_id: 'AgACfile',
      media_type: 'photo',
      text: 'paid 10:30',
    });
  });

  it('sends the image alone when there is no note', () => {
    expect(buildC2cReceiptPayload(7, { file_id: 'f', media_type: 'photo' }, '   ')).toEqual({
      receipt_id: 7,
      media_file_id: 'f',
      media_type: 'photo',
    });
  });

  it('sends a note alone', () => {
    expect(buildC2cReceiptPayload(7, null, 'ref 123456')).toEqual({
      receipt_id: 7,
      text: 'ref 123456',
    });
  });

  it('refuses an empty receipt before it reaches the server', () => {
    expect(buildC2cReceiptPayload(7, null, '  ')).toBeNull();
  });
});

describe('isC2cAwaitingReview', () => {
  it('is true only for a pending receipt that carries a receipt', () => {
    expect(isC2cAwaitingReview(state({ has_receipt: true }))).toBe(true);
    expect(isC2cAwaitingReview(state())).toBe(false);
    expect(isC2cAwaitingReview(state({ status: 'approved', has_receipt: true }))).toBe(false);
    expect(isC2cAwaitingReview(null)).toBe(false);
  });
});
