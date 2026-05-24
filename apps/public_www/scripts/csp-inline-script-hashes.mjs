// Collects CSP sha256- hashes for inline <script> bodies in static HTML.
// Next.js static export embeds flight/hydration payloads as inline scripts;
// script-src 'self' alone blocks them and prevents React from hydrating.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const INLINE_SCRIPT_PATTERN =
  /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * @param {string} scriptBody
 * @returns {string}
 */
export function hashInlineScriptBody(scriptBody) {
  const digest = createHash('sha256')
    .update(scriptBody, 'utf8')
    .digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function collectInlineScriptHashesFromHtml(html) {
  const hashes = new Set();
  for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
    const body = match[2];
    if (!body.trim()) {
      continue;
    }
    hashes.add(hashInlineScriptBody(body));
  }
  return [...hashes];
}

/**
 * @param {string} outDir
 * @returns {Promise<string[]>}
 */
export async function collectInlineScriptHashesFromOutDir(outDir) {
  const hashes = new Set();
  for await (const filePath of walkHtmlFiles(outDir)) {
    const html = await fs.readFile(filePath, 'utf8');
    for (const hash of collectInlineScriptHashesFromHtml(html)) {
      hashes.add(hash);
    }
  }
  return [...hashes].sort();
}

/**
 * @param {string} dir
 */
async function* walkHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtmlFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield fullPath;
    }
  }
}
