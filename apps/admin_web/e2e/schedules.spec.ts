import { test, expect } from './fixtures/test-fixtures';

test.describe('Schedules Panel', () => {
  test('creates a weekly schedule entry', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard?section=schedules');
    await expect(
      adminPage.getByRole('heading', { name: 'Schedules', exact: true })
    ).toBeVisible();

    await adminPage.locator('#schedule-location').selectOption('loc-1');
    await adminPage.locator('#schedule-activity').selectOption('activity-1');

    await adminPage.getByRole('button', { name: 'Mon' }).click();
    await adminPage.getByLabel('Start Time (Local)').first().selectOption({ index: 2 });
    await adminPage.getByLabel('End Time (Local)').first().selectOption({ index: 4 });
    await adminPage.getByRole('button', { name: /Toggle English/i }).click();

    await adminPage.getByRole('button', { name: 'Add Schedule' }).click();
    await expect(adminPage.getByRole('table')).toContainText('01:00-02:00');
  });
});
