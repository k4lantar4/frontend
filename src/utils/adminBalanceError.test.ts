import { describe, expect, it } from 'vitest';
import { adminBalanceErrorKey } from './adminBalance';

const refused = (field: string) => ({
  response: {
    status: 422,
    data: { detail: [{ loc: ['body', field], msg: 'less than or equal' }] },
  },
});

describe('adminBalanceErrorKey', () => {
  it.each(['amount_display', 'amount_kopeks'])(
    'names the per-edit cap when the API refuses %s (422)',
    (field) => {
      expect(adminBalanceErrorKey(refused(field))).toBe('admin.users.detail.balance.updateLimit');
    },
  );

  it.each([
    refused('description'),
    { response: { status: 422 } },
    { response: { status: 500 } },
    new Error('Network Error'),
    undefined,
  ])('falls back to the generic message for %j', (error) => {
    expect(adminBalanceErrorKey(error)).toBe('admin.users.detail.balance.updateError');
  });
});
