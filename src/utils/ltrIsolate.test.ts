import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('url-ltr css', () => {
  it('defines isolate for RTL URL fields', () => {
    const css = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.url-ltr\s*\{/);
    expect(css).toMatch(/unicode-bidi:\s*isolate/);
  });
});
