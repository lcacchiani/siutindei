// Validates that every HTML file in the static export carries the CSP meta
// marker injected by inject-csp-meta.mjs. Runs after the inject step so that
// "build" never deploys partially protected HTML.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const META_MARKER = '<!-- csp-meta -->';

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

async function main() {
  const missing = [];
  for await (const filePath of walk(OUT_DIR)) {
    const contents = await fs.readFile(filePath, 'utf8');
    if (!contents.includes(META_MARKER)) {
      missing.push(filePath);
    }
  }
  if (missing.length > 0) {
    console.error('csp:validate — HTML files without CSP meta:');
    for (const filePath of missing) {
      console.error(`- ${filePath}`);
    }
    process.exit(1);
  }
  console.log('csp:validate — all HTML files contain a CSP meta tag.');
}

main().catch((error) => {
  console.error('csp:validate failed:', error);
  process.exit(1);
});
