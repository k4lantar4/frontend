import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const USER_ROOTS = new Set([
  'common',
  'subscription',
  'dashboard',
  'gift',
  'balance',
  'profile',
  'support',
  'wheel',
  'merge',
  'quickPurchase',
  'purchase',
  'traffic',
  'devices',
  'nav',
]);

function walk(obj: unknown, prefix: string, visit: (path: string, value: string) => void): void {
  if (typeof obj === 'string') {
    visit(prefix, obj);
    return;
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      walk(v, prefix ? `${prefix}.${k}` : k, visit);
    }
  }
}

describe('fa user terminology', () => {
  const fa = JSON.parse(readFileSync(new URL('./fa.json', import.meta.url), 'utf8')) as unknown;

  it('user roots do not say دستگاه', () => {
    const hits: string[] = [];
    walk(fa, '', (path, value) => {
      const root = path.split('.')[0];
      if (root === 'admin') return;
      if (!USER_ROOTS.has(root)) return;
      if (value.includes('دستگاه')) hits.push(path);
    });
    expect(hits).toEqual([]);
  });

  it('dashboard.devicesConnectedUnlimited uses {{used}} and not دستگاه', () => {
    const faObj = fa as Record<string, Record<string, string>>;
    const value = faObj.dashboard.devicesConnectedUnlimited;
    expect(value).toContain('{{used}}');
    expect(value).not.toContain('دستگاه');
  });
});
