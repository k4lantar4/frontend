import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('directional icons', () => {
  it('flips back and chevron in rtl', () => {
    const src = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/export const BackIcon[\s\S]*rtl:scale-x-\[-1\]/);
    expect(src).toMatch(/export const ChevronRightIcon[\s\S]*rtl:scale-x-\[-1\]/);
    expect(src).not.toMatch(/export const SearchIcon[\s\S]*rtl:scale-x-\[-1\]/);
  });
});
