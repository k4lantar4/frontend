import { describe, expect, it } from 'vitest';
import { formatUserDate, formatUserDateTime } from './formatDate';

const ANCHOR = '2026-07-09T12:00:00Z';

describe('formatUserDate', () => {
  it('returns em dash for null', () => {
    expect(formatUserDate(null)).toBe('—');
  });

  it('uses Persian calendar and Latin digits for fa', () => {
    const rendered = formatUserDate(ANCHOR, 'fa');
    expect(rendered).toMatch(/1405/);
    expect(rendered).toMatch(/04/);
    expect(rendered).toMatch(/18/);
    expect(rendered).not.toMatch(/[۰-۹]/);
  });

  it('stays Gregorian for en', () => {
    const rendered = formatUserDate(ANCHOR, 'en');
    expect(rendered).toMatch(/2026/);
  });
});

describe('formatUserDateTime', () => {
  it('includes a time part for fa', () => {
    const rendered = formatUserDateTime(ANCHOR, 'fa');
    expect(rendered.length).toBeGreaterThan(formatUserDate(ANCHOR, 'fa').length);
  });
});
