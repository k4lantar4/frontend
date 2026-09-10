// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  type BrandingInfo,
  getCachedBranding,
  isBrandingInfo,
  setCachedBranding,
} from './branding';

/**
 * The cached branding is the starting data of every page (useDocumentBranding's
 * initialData), read before the fresh API answer arrives. A cached value that is
 * not real branding — e.g. an HTML page that came back with status 200 and was
 * stored as a string — crashed the whole cabinet on every load in that tab:
 * "can't access property 'trim', branding.name is undefined". The cache must only
 * ever hold, and only ever return, real branding.
 */

const KEY = 'cabinet_branding';
const VALID: BrandingInfo = {
  name: 'Moon VPN',
  logo_url: null,
  logo_letter: 'M',
  has_custom_logo: false,
};

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

const POISONED: Array<[string, string]> = [
  ['an HTML page cached as a string', JSON.stringify('<!doctype html><html></html>')],
  ['an object without a name', JSON.stringify({ logo_letter: 'M', has_custom_logo: false })],
  ['a non-string name', JSON.stringify({ ...VALID, name: 42 })],
  ['null', 'null'],
];

describe('branding cache', () => {
  it('returns real cached branding', () => {
    sessionStorage.setItem(KEY, JSON.stringify(VALID));
    expect(getCachedBranding()).toEqual(VALID);
  });

  it.each(POISONED)('drops %s instead of returning it', (_label, raw) => {
    sessionStorage.setItem(KEY, raw);
    expect(getCachedBranding()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('drops a poisoned legacy localStorage value too', () => {
    localStorage.setItem(KEY, JSON.stringify('<!doctype html>'));
    expect(getCachedBranding()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('never stores something that is not branding', () => {
    setCachedBranding('<!doctype html>' as unknown as BrandingInfo);
    expect(sessionStorage.getItem(KEY)).toBeNull();

    setCachedBranding(VALID);
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toEqual(VALID);
  });

  it('recognises branding by a string name', () => {
    expect(isBrandingInfo(VALID)).toBe(true);
    expect(isBrandingInfo('<!doctype html>')).toBe(false);
    expect(isBrandingInfo({ logo_letter: 'M' })).toBe(false);
    expect(isBrandingInfo(null)).toBe(false);
  });
});
