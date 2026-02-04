import { test, expect } from './fixtures/test-fixtures';

test.describe('Admin Dashboard', () => {
  test('should display header with title and description', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Check header
    await expect(adminPage.getByRole('heading', { name: 'Siu Tin Dei Admin' })).toBeVisible();
    await expect(
      adminPage.getByText('Manage organizations, activities, and schedules.')
    ).toBeVisible();
  });

  test('should display all navigation sections', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Check all navigation buttons
    const expectedSections = [
      'Organizations',
      'Media',
      'Locations',
      'Activities',
      'Pricing',
      'Schedules',
      'Access Requests',
      'Cognito Users',
    ];

    for (const section of expectedSections) {
      await expect(adminPage.getByRole('button', { name: section })).toBeVisible();
    }
  });

  test('should highlight Organizations as default active section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Organizations should be selected by default
    const organizationsButton = adminPage.getByRole('button', { name: 'Organizations' });
    await expect(organizationsButton).toBeVisible();

    // Check that Organizations panel is visible
    await expect(
      adminPage.getByRole('heading', { name: /Organization/i }).first()
    ).toBeVisible();
  });

  test('should navigate to Media section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Media
    await adminPage.getByRole('button', { name: 'Media' }).click();

    // Should show Media panel content
    await expect(adminPage.getByText(/Media/i)).toBeVisible();
  });

  test('should navigate to Locations section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Locations
    await adminPage.getByRole('button', { name: 'Locations' }).click();

    // Should show Locations panel content
    await expect(adminPage.getByRole('heading', { name: /Location/i }).first()).toBeVisible();
  });

  test('should navigate to Activities section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Activities
    await adminPage.getByRole('button', { name: 'Activities' }).click();

    // Should show Activities panel content
    await expect(adminPage.getByRole('heading', { name: /Activities/i }).first()).toBeVisible();
  });

  test('should navigate to Pricing section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Pricing
    await adminPage.getByRole('button', { name: 'Pricing' }).click();

    // Should show Pricing panel content
    await expect(adminPage.getByText(/Pricing/i).first()).toBeVisible();
  });

  test('should navigate to Schedules section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Schedules
    await adminPage.getByRole('button', { name: 'Schedules' }).click();

    // Should show Schedules panel content
    await expect(adminPage.getByText(/Schedule/i).first()).toBeVisible();
  });

  test('should navigate to Access Requests section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Access Requests
    await adminPage.getByRole('button', { name: 'Access Requests' }).click();

    // Should show Access Requests panel content
    await expect(adminPage.getByText(/Access Request/i).first()).toBeVisible();
  });

  test('should navigate to Cognito Users section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Click Cognito Users
    await adminPage.getByRole('button', { name: 'Cognito Users' }).click();

    // Should show Cognito Users panel content
    await expect(adminPage.getByText(/Cognito User/i).first()).toBeVisible();
  });

  test('should switch between sections correctly', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Start at Organizations (default)
    await expect(
      adminPage.getByRole('heading', { name: /Organization/i }).first()
    ).toBeVisible();

    // Switch to Activities
    await adminPage.getByRole('button', { name: 'Activities' }).click();
    await expect(adminPage.getByRole('heading', { name: /Activities/i }).first()).toBeVisible();

    // Switch to Locations
    await adminPage.getByRole('button', { name: 'Locations' }).click();
    await expect(adminPage.getByRole('heading', { name: /Location/i }).first()).toBeVisible();

    // Switch back to Organizations
    await adminPage.getByRole('button', { name: 'Organizations' }).click();
    await expect(
      adminPage.getByRole('heading', { name: /Organization/i }).first()
    ).toBeVisible();
  });

  test('should display user email in header', async ({ adminPage }) => {
    await adminPage.goto('/');

    await expect(adminPage.getByText('admin@example.com')).toBeVisible();
  });

  test('should have visible logout button', async ({ adminPage }) => {
    await adminPage.goto('/');

    const logoutButton = adminPage.getByRole('button', { name: 'Log out' });
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toBeEnabled();
  });
});

test.describe('Admin Dashboard Layout', () => {
  test('should have sidebar navigation', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Check that nav element exists with buttons
    const navButtons = adminPage.locator('nav button');
    await expect(navButtons).toHaveCount(8); // 8 navigation sections
  });

  test('should have main content area', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Main content should be visible
    const mainContent = adminPage.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('should display divider before Access Requests section', async ({ adminPage }) => {
    await adminPage.goto('/');

    // Check that a horizontal rule exists in the navigation
    const dividers = adminPage.locator('nav hr');
    await expect(dividers).toHaveCount(1);
  });
});
