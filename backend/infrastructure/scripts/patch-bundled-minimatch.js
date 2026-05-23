/**
 * Patches vulnerable bundled minimatch and brace-expansion inside
 * aws-cdk-lib with the top-level dependencies that include security fixes
 * for GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74, and brace-expansion
 * ReDoS advisories (e.g. GHSA-v6mv-4v72-8cf6).
 *
 * aws-cdk-lib bundles these packages in its tarball, so npm overrides cannot
 * replace them. This postinstall script copies the patched copies over the
 * bundled ones after every install.
 */

const fs = require('fs');
const path = require('path');

const infraRoot = path.join(__dirname, '..');
const cdkBundledRoot = path.join(
  infraRoot,
  'node_modules',
  'aws-cdk-lib',
  'node_modules',
);

const patches = [
  {
    name: 'minimatch',
    source: path.join(infraRoot, 'node_modules', 'minimatch'),
    target: path.join(cdkBundledRoot, 'minimatch'),
  },
  {
    name: 'brace-expansion',
    source: path.join(infraRoot, 'node_modules', 'brace-expansion'),
    target: path.join(cdkBundledRoot, 'brace-expansion'),
  },
];

for (const { name, source, target } of patches) {
  if (!fs.existsSync(source)) {
    console.warn(`[patch-bundled-deps] ${name} source not found, skipping`);
    continue;
  }

  if (!fs.existsSync(target)) {
    console.warn(`[patch-bundled-deps] ${name} target not found, skipping`);
    continue;
  }

  fs.cpSync(source, target, { recursive: true });

  const patchedVersion = require(path.join(target, 'package.json')).version;
  console.log(
    `[patch-bundled-deps] replaced bundled ${name} with ${patchedVersion}`,
  );
}
