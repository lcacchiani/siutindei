import { describe, expect, it } from 'vitest';

import {
  collectInlineScriptHashesFromHtml,
  hashInlineScriptBody,
} from '../../scripts/csp-inline-script-hashes.mjs';

describe('csp-inline-script-hashes', () => {
  it('hashes inline script bodies for CSP script-src', () => {
    const body = 'self.__next_f.push([1,"test"])';
    const hash = hashInlineScriptBody(body);
    expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+={0,2}'$/);
    expect(collectInlineScriptHashesFromHtml(
      `<script>${body}</script>`,
    )).toContain(hash);
  });

  it('ignores external script tags', () => {
    const html =
      '<script src="/_next/static/chunks/app.js"></script>' +
      '<script>inline()</script>';
    const hashes = collectInlineScriptHashesFromHtml(html);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).toBe(hashInlineScriptBody('inline()'));
  });

  it('skips empty inline script tags', () => {
    expect(collectInlineScriptHashesFromHtml('<script></script>')).toEqual([]);
  });
});
