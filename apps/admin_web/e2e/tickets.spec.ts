import { test, expect } from './fixtures/test-fixtures';

test.describe('Tickets Panel', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard?section=tickets');
    await expect(adminPage.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  });

  test('lists and filters tickets', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('cell', { name: 'T00001' }).first()
    ).toBeVisible();

    await adminPage.getByLabel('Type').selectOption('access_request');
    await adminPage.getByLabel('Status').selectOption('pending');

    const search = adminPage.getByPlaceholder('Search tickets...');
    await search.fill('pending@example.com');
    await expect(
      adminPage.getByRole('table').getByText('pending@example.com').first()
    ).toBeVisible();
  });

  test('reviews a pending ticket', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: 'Review ticket' }).first().click();
    await expect(adminPage.getByText('Review Ticket:')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Approve' }).click();
    await expect(adminPage.getByText('Failed to process ticket')).not.toBeVisible();
  });
});
