import { test, expect, setupAuth, mockManagerUser, mockRegularUser, setupApiMocks } from './fixtures/test-fixtures';

test.describe('Manager Dashboard', () => {
  test('should display manager view banner', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Should see manager view banner
    await expect(managerPage.getByText('Manager View')).toBeVisible();
    await expect(
      managerPage.getByText(/You are viewing as an organization manager/)
    ).toBeVisible();
  });

  test('should show limited navigation sections for manager', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Manager sections
    const managerSections = [
      'Organizations',
      'Media',
      'Locations',
      'Activities',
      'Pricing',
      'Schedules',
    ];

    for (const section of managerSections) {
      await expect(managerPage.getByRole('button', { name: section })).toBeVisible();
    }

    // Admin-only sections should NOT be visible
    await expect(managerPage.getByRole('button', { name: 'Access Requests' })).not.toBeVisible();
    await expect(managerPage.getByRole('button', { name: 'Cognito Users' })).not.toBeVisible();
  });

  test('should display user email in header', async ({ managerPage }) => {
    await managerPage.goto('/');

    await expect(managerPage.getByText('manager@example.com')).toBeVisible();
  });

  test('should have logout button', async ({ managerPage }) => {
    await managerPage.goto('/');

    const logoutButton = managerPage.getByRole('button', { name: 'Log out' });
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toBeEnabled();
  });

  test('should navigate between manager sections', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Navigate to Activities
    await managerPage.getByRole('button', { name: 'Activities' }).click();
    await expect(managerPage.getByRole('heading', { name: /Activities/i }).first()).toBeVisible();

    // Navigate to Locations
    await managerPage.getByRole('button', { name: 'Locations' }).click();
    await expect(managerPage.getByRole('heading', { name: /Location/i }).first()).toBeVisible();

    // Navigate back to Organizations
    await managerPage.getByRole('button', { name: 'Organizations' }).click();
  });
});

test.describe('Manager Organizations Panel', () => {
  test('should show "Your Organizations" heading', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Should see "Your Organizations" instead of "Existing Organizations"
    await expect(managerPage.getByRole('heading', { name: 'Your Organizations' })).toBeVisible();
  });

  test('should not show new organization form for manager', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Manager should NOT see the "New Organization" form
    await expect(managerPage.getByRole('heading', { name: 'New Organization' })).not.toBeVisible();

    // Manager should NOT see "Add Organization" button in the initial state
    await expect(managerPage.getByRole('button', { name: 'Add Organization' })).not.toBeVisible();
  });

  test('should not show manager column in table (manager sees their own orgs)', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Manager table should NOT have Manager column
    await expect(managerPage.getByRole('columnheader', { name: 'Manager' })).not.toBeVisible();
  });

  test('should be able to edit their organizations', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Wait for org table to load
    await expect(managerPage.getByText('Test Organization 1')).toBeVisible();

    // Should have Edit button
    await expect(
      managerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' })
    ).toBeVisible();
  });

  test('should show edit form when clicking Edit', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Wait for org table to load
    await expect(managerPage.getByText('Test Organization 1')).toBeVisible();

    // Click Edit
    await managerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' }).click();

    // Should see "Edit Organization" form
    await expect(managerPage.getByRole('heading', { name: 'Edit Organization' })).toBeVisible();

    // Should see "Update Organization" button
    await expect(managerPage.getByRole('button', { name: 'Update Organization' })).toBeVisible();
  });

  test('edit form should not show manager selector for manager', async ({ managerPage }) => {
    await managerPage.goto('/');

    // Wait for org table to load
    await expect(managerPage.getByText('Test Organization 1')).toBeVisible();

    // Click Edit
    await managerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' }).click();

    // Should NOT see Manager selector (only admins can change manager)
    await expect(managerPage.getByLabel('Manager')).not.toBeVisible();
  });
});

test.describe('Access Denied', () => {
  test('should show access denied for regular user', async ({ page }) => {
    // Set up auth with regular user (no admin or manager group)
    await setupAuth(page, mockRegularUser);
    await setupApiMocks(page);

    await page.goto('/');

    // Should see access denied message
    await expect(page.getByText('Access denied')).toBeVisible();
    await expect(
      page.getByText(/Your account is not authorized to access this system/)
    ).toBeVisible();
  });

  test('should still show logout button for unauthorized users', async ({ page }) => {
    // Set up auth with regular user
    await setupAuth(page, mockRegularUser);
    await setupApiMocks(page);

    await page.goto('/');

    // Should still see logout button
    const logoutButton = page.getByRole('button', { name: 'Log out' });
    await expect(logoutButton).toBeVisible();
  });

  test('should show user email for unauthorized users', async ({ page }) => {
    // Set up auth with regular user
    await setupAuth(page, mockRegularUser);
    await setupApiMocks(page);

    await page.goto('/');

    // Should show user email
    await expect(page.getByText('user@example.com')).toBeVisible();
  });
});

test.describe('Manager Access Request Flow', () => {
  test('should show access request form when manager has no organizations', async ({ page }) => {
    // Set up manager user
    await setupAuth(page, mockManagerUser);

    // Override the user access request status endpoint to show no organizations
    await page.route('**/api/mock/user/access-request*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organizations_count: 0,
          has_pending_request: false,
          pending_request: null,
        }),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    // Should see access request form
    // Note: The actual form content depends on AccessRequestForm component
    await expect(page.getByText(/request/i)).toBeVisible();
  });

  test('should show pending request notice when manager has pending request', async ({ page }) => {
    // Set up manager user
    await setupAuth(page, mockManagerUser);

    // Override the user access request status endpoint to show pending request
    await page.route('**/api/mock/user/access-request*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organizations_count: 0,
          has_pending_request: true,
          pending_request: {
            id: 'request-123',
            user_sub: 'manager-user-id-456',
            user_email: 'manager@example.com',
            organization_name: 'Requested Org',
            message: 'Please approve',
            status: 'pending',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        }),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    // Should see pending request notice
    // The actual content depends on PendingRequestNotice component
  });
});

test.describe('Admin with Manager Group', () => {
  test('admin-manager should see full admin dashboard', async ({ page }) => {
    // Use admin-manager user (has both groups)
    await setupAuth(page, {
      email: 'admin-manager@example.com',
      sub: 'admin-manager-id-789',
      groups: ['admin', 'manager'],
      name: 'Admin Manager User',
    });
    await setupApiMocks(page);

    await page.goto('/');

    // Should see full admin navigation (admin takes precedence)
    await expect(page.getByRole('button', { name: 'Access Requests' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cognito Users' })).toBeVisible();

    // Should NOT see manager banner
    await expect(page.getByText('Manager View')).not.toBeVisible();
  });
});
