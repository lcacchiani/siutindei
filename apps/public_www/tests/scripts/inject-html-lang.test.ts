import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd());
const scriptPath = join(appRoot, 'scripts/inject-html-lang.mjs');

function runInject(outDir: string): void {
  execSync(`node "${scriptPath}"`, {
    cwd: appRoot,
    env: { ...process.env, PUBLIC_WWW_OUT_DIR: outDir },
    stdio: 'pipe',
  });
}

describe('inject-html-lang', () => {
  it('sets lang from the first path segment under out/', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'public-www-lang-'));
    mkdirSync(join(outDir, 'zh-HK'), { recursive: true });
    const htmlPath = join(outDir, 'zh-HK', 'index.html');
    writeFileSync(
      htmlPath,
      '<!DOCTYPE html><html lang="en"><head></head><body></body></html>',
      'utf8',
    );

    runInject(outDir);

    const updated = readFileSync(htmlPath, 'utf8');
    expect(updated).toContain('<html lang="zh-HK"');
  });

  it('defaults to en for HTML outside locale folders', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'public-www-lang-'));
    const htmlPath = join(outDir, '404.html');
    writeFileSync(
      htmlPath,
      '<!DOCTYPE html><html><head></head><body></body></html>',
      'utf8',
    );

    runInject(outDir);

    const updated = readFileSync(htmlPath, 'utf8');
    expect(updated).toContain('<html lang="en"');
  });
});
