// Inserts a <meta http-equiv="Content-Security-Policy"> tag into every
// generated HTML in the static export. Aligns with evolvesprouts: extend
// script-src / connect-src when GTM or Meta Pixel init scripts are enabled.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const META_MARKER = '<!-- csp-meta -->';

const GTM_SCRIPT_ORIGINS = [
  'https://www.googletagmanager.com',
  'https://googleads.g.doubleclick.net',
  'https://www.googleadservices.com',
];
const GTM_CONNECT_ORIGINS = [
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://region1.google-analytics.com',
  'https://stats.g.doubleclick.net',
  'https://www.google.com',
  'https://googleads.g.doubleclick.net',
];
const META_PIXEL_SCRIPT_ORIGINS = ['https://connect.facebook.net'];
const META_PIXEL_CONNECT_ORIGINS = ['https://www.facebook.com'];

function buildCspDirectives() {
  const hasGtm = Boolean(process.env.NEXT_PUBLIC_GTM_ID?.trim());
  const hasMetaPixel = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim());

  const scriptSources = ["'self'"];
  const connectSources = ["'self'"];

  if (hasGtm) {
    scriptSources.push(...GTM_SCRIPT_ORIGINS);
    connectSources.push(...GTM_CONNECT_ORIGINS);
  }
  if (hasMetaPixel) {
    scriptSources.push(...META_PIXEL_SCRIPT_ORIGINS);
    connectSources.push(...META_PIXEL_CONNECT_ORIGINS);
  }

  return [
    "default-src 'self'",
    `img-src 'self' data: https:`,
    "style-src 'self' 'unsafe-inline'",
    `script-src ${[...new Set(scriptSources)].join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${[...new Set(connectSources)].join(' ')}`,
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

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

async function injectIntoFile(filePath, metaTag) {
  const original = await fs.readFile(filePath, 'utf8');
  if (original.includes(META_MARKER)) {
    return false;
  }
  const headOpenRegex = /<head([^>]*)>/i;
  if (!headOpenRegex.test(original)) {
    return false;
  }
  const replacement = `<head$1>\n    ${META_MARKER}\n    ${metaTag}`;
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

  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${buildCspDirectives()}">`;
  let updatedCount = 0;
  let totalCount = 0;
  for await (const filePath of walk(OUT_DIR)) {
    totalCount += 1;
    const updated = await injectIntoFile(filePath, metaTag);
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
