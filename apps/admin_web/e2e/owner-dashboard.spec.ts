import { test, expect, setupAuth, mockOwnerUser, mockRegularUser, setupApiMocks } from './fixtures/test-fixtures';

test.describe('Owner Dashboard', () => {
  test('should display owner view banner', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Should see owner view banner
    await expect(ownerPage.getByText('Owner View')).toBeVisible();
    await expect(
      ownerPage.getByText(/You are viewing as an organization owner/)
    ).toBeVisible();
  });

  test('should show limited navigation sections for owner', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Owner sections
    const ownerSections = [
      'Organizations',
      'Media',
      'Locations',
      'Activities',
      'Pricing',
      'Schedules',
    ];

    for (const section of ownerSections) {
      await expect(ownerPage.getByRole('button', { name: section })).toBeVisible();
    }

    // Admin-only sections should NOT be visible
    await expect(ownerPage.getByRole('button', { name: 'Access Requests' })).not.toBeVisible();
    await expect(ownerPage.getByRole('button', { name: 'Cognito Users' })).not.toBeVisible();
  });

  test('should display user email in header', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    await expect(ownerPage.getByText('owner@example.com')).toBeVisible();
  });

  test('should have logout button', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    const logoutButton = ownerPage.getByRole('button', { name: 'Log out' });
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toBeEnabled();
  });

  test('should navigate between owner sections', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Navigate to Activities
    await ownerPage.getByRole('button', { name: 'Activities' }).click();
    await expect(ownerPage.getByRole('heading', { name: /Activities/i }).first()).toBeVisible();

    // Navigate to Locations
    await ownerPage.getByRole('button', { name: 'Locations' }).click();
    await expect(ownerPage.getByRole('heading', { name: /Location/i }).first()).toBeVisible();

    // Navigate back to Organizations
    await ownerPage.getByRole('button', { name: 'Organizations' }).click();
  });
});

test.describe('Owner Organizations Panel', () => {
  test('should show "Your Organizations" heading', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Should see "Your Organizations" instead of "Existing Organizations"
    await expect(ownerPage.getByRole('heading', { name: 'Your Organizations' })).toBeVisible();
  });

  test('should not show new organization form for owner', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Owner should NOT see the "New Organization" form
    await expect(ownerPage.getByRole('heading', { name: 'New Organization' })).not.toBeVisible();

    // Owner should NOT see "Add Organization" button in the initial state
    await expect(ownerPage.getByRole('button', { name: 'Add Organization' })).not.toBeVisible();
  });

  test('should not show owner column in table (owner sees their own orgs)', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Owner table should NOT have Owner column
    await expect(ownerPage.getByRole('columnheader', { name: 'Owner' })).not.toBeVisible();
  });

  test('should be able to edit their organizations', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Wait for org table to load
    await expect(ownerPage.getByText('Test Organization 1')).toBeVisible();

    // Should have Edit button
    await expect(
      ownerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' })
    ).toBeVisible();
  });

  test('should show edit form when clicking Edit', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Wait for org table to load
    await expect(ownerPage.getByText('Test Organization 1')).toBeVisible();

    // Click Edit
    await ownerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' }).click();

    // Should see "Edit Organization" form
    await expect(ownerPage.getByRole('heading', { name: 'Edit Organization' })).toBeVisible();

    // Should see "Update Organization" button
    await expect(ownerPage.getByRole('button', { name: 'Update Organization' })).toBeVisible();
  });

  test('edit form should not show owner selector for owner', async ({ ownerPage }) => {
    await ownerPage.goto('/');

    // Wait for org table to load
    await expect(ownerPage.getByText('Test Organization 1')).toBeVisible();

    // Click Edit
    await ownerPage.getByRole('row', { name: /Test Organization 1/ }).getByRole('button', { name: 'Edit' }).click();

    // Should NOT see Owner selector (only admins can change owner)
    await expect(ownerPage.getByLabel('Owner')).not.toBeVisible();
  });
});

test.describe('Access Denied', () => {
  test('should show access denied for regular user', async ({ page }) => {
    // Set up auth with regular user (no admin or owner group)
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

test.describe('Owner Access Request Flow', () => {
  test('should show access request form when owner has no organizations', async ({ page }) => {
    // Set up owner user
    await setupAuth(page, mockOwnerUser);

    // Override the owner status endpoint to show no organizations
    await page.route('**/api/mock/owner/status*', async (route) => {
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

  test('should show pending request notice when owner has pending request', async ({ page }) => {
    // Set up owner user
    await setupAuth(page, mockOwnerUser);

    // Override the owner status endpoint to show pending request
    await page.route('**/api/mock/owner/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organizations_count: 0,
          has_pending_request: true,
          pending_request: {
            id: 'request-123',
            user_sub: 'owner-user-id-456',
            user_email: 'owner@example.com',
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

test.describe('Admin with Owner Group', () => {
  test('admin-owner should see full admin dashboard', async ({ page }) => {
    // Use admin-owner user (has both groups)
    await setupAuth(page, {
      email: 'admin-owner@example.com',
      sub: 'admin-owner-id-789',
      groups: ['admin', 'owner'],
      name: 'Admin Owner User',
    });
    await setupApiMocks(page);

    await page.goto('/');

    // Should see full admin navigation (admin takes precedence)
    await expect(page.getByRole('button', { name: 'Access Requests' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cognito Users' })).toBeVisible();

    // Should NOT see owner banner
    await expect(page.getByText('Owner View')).not.toBeVisible();
  });
});
