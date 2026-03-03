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
    await expect(adminPage.getByRole('table')).toContainText('UPDATE');

    await adminPage.getByRole('button', { name: 'View details' }).first().click();
    const detailDialog = adminPage.getByRole('dialog');
    await expect(detailDialog.getByText('Audit Log Detail')).toBeVisible();
    await expect(detailDialog.getByText('Record ID')).toBeVisible();
    await detailDialog.getByLabel('Close').click();
    await expect(adminPage.getByText('Audit Log Detail')).not.toBeVisible();
  });
});
