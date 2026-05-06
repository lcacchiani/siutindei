/**
 * Fails the build when required NEXT_PUBLIC_* variables for the public website
 * are missing or empty. Keep this list in sync with:
 *   .github/workflows/deploy-public-www.yml  (Build public website env block)
 *   .github/workflows/promote-public-www.yml (Build public website env block)
 */
const REQUIRED = ['NEXT_PUBLIC_SITE_ORIGIN', 'NEXT_PUBLIC_SITE_NAME'];

let failed = false;
for (const name of REQUIRED) {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    console.error(`Missing or empty required env: ${name}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
