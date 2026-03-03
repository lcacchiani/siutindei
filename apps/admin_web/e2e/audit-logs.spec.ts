import { test, expect } from './fixtures/test-fixtures';

test.describe('Audit Logs Panel', () => {
  test('filters logs and opens detail modal', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard?section=audit-logs');
    await expect(adminPage.getByRole('heading', { name: 'Audit Logs' })).toBeVisible();

    await expect(
      adminPage.getByRole('cell', { name: 'organizations' }).first()
    ).toBeVisible();

    await adminPage.getByLabel('Action').selectOption('UPDATE');
    await adminPage.getByRole('button', { name: 'Apply Filters' }).click();

    await adminPage.getByRole('button', { name: 'View details' }).first().click();
    await expect(adminPage.getByText('Audit Log Detail')).toBeVisible();
    await adminPage.getByRole('dialog').getByLabel('Close').click();
  });
});
