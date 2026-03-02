/**
 * Patches the vulnerable bundled minimatch inside aws-cdk-lib with the
 * top-level minimatch dependency (10.2.4+) that includes security fixes
 * for GHSA-7r86-cg39-jmmj and GHSA-23c5-xmqv-rm74.
 *
 * aws-cdk-lib bundles minimatch in its tarball, so npm overrides cannot
 * replace it. This postinstall script copies the patched copy over the
 * bundled one after every install.
 */

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'minimatch');
const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'aws-cdk-lib',
  'node_modules',
  'minimatch',
);

if (!fs.existsSync(source)) {
  console.warn('[patch-bundled-minimatch] source not found, skipping');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  console.warn('[patch-bundled-minimatch] target not found, skipping');
  process.exit(0);
}

fs.cpSync(source, target, { recursive: true });

const patchedVersion = require(path.join(target, 'package.json')).version;
console.log(
  `[patch-bundled-minimatch] replaced bundled minimatch with ${patchedVersion}`,
);
