import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TrafficUsageText } from './TrafficUsageText';

describe('TrafficUsageText', () => {
  it('sets dir=ltr and unicode-bidi isolate', () => {
    const html = renderToStaticMarkup(
      createElement(TrafficUsageText, { usedGb: 0, limitGb: 10, isUnlimited: false }),
    );
    expect(html).toContain('dir="ltr"');
    expect(html).toMatch(/unicode-bidi:isolate|unicode-bidi: isolate/);
  });
});
