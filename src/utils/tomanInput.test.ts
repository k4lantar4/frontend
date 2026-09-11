import { describe, expect, it } from 'vitest';
import { normalizeTomanInput } from './tomanInput';

describe('normalizeTomanInput', () => {
  // A Toman amount has no decimals: a comma is a thousands separator, not «,50».
  it.each([
    ['150,000', '150000'],
    ['1,500,000', '1500000'],
    ['۱۵۰۰۰۰', '150000'],
    ['١٥٠٠٠٠', '150000'],
    ['۱۵۰٬۰۰۰', '150000'],
    [' 150 000 ', '150000'],
    ['150000 تومان', '150000'],
    ['150000', '150000'],
    ['', ''],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeTomanInput(raw)).toBe(expected);
  });
});
