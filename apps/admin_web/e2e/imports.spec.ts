import { test, expect } from './fixtures/test-fixtures';

test.describe('Imports Panel', () => {
  test('redirects to imports section and runs import', async ({ adminPage }) => {
    await adminPage.goto('/admin/imports');
    await expect(adminPage).toHaveURL(/section=imports/);
    await expect(adminPage.getByRole('heading', { name: 'Imports' })).toBeVisible();

    const jsonFile = {
      name: 'import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ organizations: [] })),
    };

    await adminPage.setInputFiles('#admin-import-file', jsonFile);
    await adminPage.getByRole('button', { name: 'Upload & Import' }).click();

    await expect(adminPage.getByText('Summary')).toBeVisible();
    await expect(adminPage.getByText(/^Organizations:/)).toBeVisible();
  });
});
