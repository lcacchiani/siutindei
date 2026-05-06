// Inserts a <meta http-equiv="Content-Security-Policy"> tag into every
// generated HTML in the static export. This complements the
// Content-Security-Policy response header set by the CloudFront response
// headers policy: the meta tag also applies when the document is opened from
// disk during local QA and gives an extra layer of defense in depth.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const META_MARKER = '<!-- csp-meta -->';
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

const META_TAG = `<meta http-equiv="Content-Security-Policy" content="${CSP_DIRECTIVES}">`;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield fullPath;
    }
  }
}

async function injectIntoFile(filePath) {
  const original = await fs.readFile(filePath, 'utf8');
  if (original.includes(META_MARKER)) {
    return false;
  }
  const headOpenRegex = /<head([^>]*)>/i;
  if (!headOpenRegex.test(original)) {
    return false;
  }
  const replacement = `<head$1>\n    ${META_MARKER}\n    ${META_TAG}`;
  const updated = original.replace(headOpenRegex, replacement);
  await fs.writeFile(filePath, updated, 'utf8');
  return true;
}

async function main() {
  try {
    await fs.access(OUT_DIR);
  } catch {
    console.error(`Build output not found: ${OUT_DIR}`);
    process.exit(1);
  }

  let updatedCount = 0;
  let totalCount = 0;
  for await (const filePath of walk(OUT_DIR)) {
    totalCount += 1;
    const updated = await injectIntoFile(filePath);
    if (updated) {
      updatedCount += 1;
    }
  }
  console.log(`csp:inject — ${updatedCount}/${totalCount} HTML files updated.`);
}

main().catch((error) => {
  console.error('csp:inject failed:', error);
  process.exit(1);
});
