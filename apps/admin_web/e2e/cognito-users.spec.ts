import { test, expect } from './fixtures/test-fixtures';

test.describe('Cognito Users Panel', () => {
  test('views attributes and updates roles', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard?section=cognito-users');
    await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible();

    await expect(
      adminPage
        .getByRole('table')
        .getByText('manager@example.com', { exact: true })
        .first()
    ).toBeVisible();

    await adminPage.getByRole('button', { name: 'View attributes' }).first().click();
    await expect(adminPage.getByText('User Attributes')).toBeVisible();
    await adminPage.getByRole('dialog').getByLabel('Close').click();

    await adminPage.getByTitle('Make Admin').first().click();
    await adminPage.getByTitle('Delete User').first().click();
    await adminPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete User' })
      .click();
  });
});
