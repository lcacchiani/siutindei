import { test, expect } from './fixtures/test-fixtures';

test.describe('Feedback Panel', () => {
  test('views feedback entries and opens edit form', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard?section=feedback');
    await expect(adminPage.getByRole('heading', { name: 'Organization Feedback' })).toBeVisible();

    await expect(
      adminPage.getByRole('cell', { name: 'Test Organization' }).first()
    ).toBeVisible();

    await adminPage.getByRole('button', { name: 'Edit' }).first().click();
    await expect(adminPage.getByRole('heading', { name: 'Edit Feedback' })).toBeVisible();
  });
});
