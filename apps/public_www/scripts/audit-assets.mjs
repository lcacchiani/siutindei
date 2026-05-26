// Lightweight asset audit: makes sure no oversized or unsafe assets sneak
// into public/. Runs before deploy so problems are caught in CI.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const PUBLIC_DIR = path.resolve('public');
const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
const FORBIDDEN_EXTENSIONS = new Set(['.exe', '.bat', '.sh', '.dmg']);
/** Generated at build time; not a committed static asset (see sync script). */
const SIZE_CHECK_IGNORE = new Set(['fixtures/activity_search_staging.json']);

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function main() {
  try {
    await fs.access(PUBLIC_DIR);
  } catch {
    console.log('audit:assets — no public/ directory; skipping.');
    return;
  }

  const failures = [];
  let totalBytes = 0;
  let count = 0;

  for await (const filePath of walk(PUBLIC_DIR)) {
    const relativePath = path.relative(PUBLIC_DIR, filePath);
    const stats = await fs.stat(filePath);
    totalBytes += stats.size;
    count += 1;

    const ext = path.extname(filePath).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      failures.push(`${filePath}: forbidden extension ${ext}`);
    }
    if (
      !SIZE_CHECK_IGNORE.has(relativePath)
      && stats.size > MAX_BYTES_PER_FILE
    ) {
      failures.push(
        `${filePath}: ${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds ` +
          `${MAX_BYTES_PER_FILE / 1024 / 1024}MB cap`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('audit:assets — failures:');
    for (const message of failures) {
      console.error(`- ${message}`);
    }
    process.exit(1);
  }

  console.log(
    `audit:assets — ${count} file(s), ${(totalBytes / 1024).toFixed(1)} KiB total.`,
  );
}

main().catch((error) => {
  console.error('audit:assets failed:', error);
  process.exit(1);
});
