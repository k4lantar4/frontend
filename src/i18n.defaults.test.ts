import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cabinet default language (Layer A)', () => {
  it('index.html first-paints fa rtl', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/<html[^>]*lang="fa"/);
    expect(html).toMatch(/dir="rtl"/);
  });

  it('i18n.ts pins DEFAULT_LNG fa and localStorage-only detection', () => {
    const src = readFileSync(new URL('./i18n.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/const DEFAULT_LNG = 'fa'/);
    expect(src).toMatch(/fallbackLng:\s*\[DEFAULT_LNG,\s*FALLBACK_LNG,\s*'en'\]/);
    expect(src).toMatch(/order:\s*\['localStorage'\]/);
    expect(src).not.toMatch(/order:\s*\['localStorage',\s*'navigator'\]/);
  });
});
