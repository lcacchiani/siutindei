import { test, expect } from './fixtures/test-fixtures';

test.describe('Activities Panel', () => {
  test.beforeEach(async ({ adminPage }) => {
  await adminPage.goto('/admin/dashboard');
    // Navigate to Activities section
    await adminPage.getByRole('button', { name: 'Activities' }).click();
  });

  test('should display the activities form', async ({ adminPage }) => {
    // Check for Activities form
    await expect(adminPage.getByRole('heading', { name: 'Activities' })).toBeVisible();

    // Check form fields
    await expect(adminPage.getByLabel('Organization')).toBeVisible();
    await expect(adminPage.getByLabel('Category')).toBeVisible();
    await expect(adminPage.getByLabel('Name')).toBeVisible();
    await expect(adminPage.getByLabel('Description')).toBeVisible();
    await expect(
      adminPage
        .getByRole('button', { name: 'Select English (en)' })
        .first()
    ).toBeVisible();
    await expect(
      adminPage
        .getByRole('button', { name: 'Select Chinese (zh)' })
        .first()
    ).toBeVisible();
    await expect(
      adminPage
        .getByRole('button', { name: 'Select Cantonese (yue)' })
        .first()
    ).toBeVisible();
    await expect(adminPage.getByLabel('Age Min')).toBeVisible();
    await expect(adminPage.getByLabel('Age Max')).toBeVisible();

    // Check for submit button
    await expect(adminPage.getByRole('button', { name: 'Add Activity' })).toBeVisible();
  });

  test('should display existing activities table', async ({ adminPage }) => {
    // Check for existing activities section
    await expect(adminPage.getByRole('heading', { name: 'Existing Activities' })).toBeVisible();

    // Check for table headers
    await expect(
      adminPage.getByRole('columnheader', { name: 'Organization / Activity' })
    ).toBeVisible();
    await expect(adminPage.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    await expect(adminPage.getByRole('columnheader', { name: 'Age Range' })).toBeVisible();
    await expect(adminPage.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    // Check for activity data
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();
    await expect(adminPage.getByText('Art Workshop')).toBeVisible();
    await expect(adminPage.getByText('Sport / Water Sports')).toBeVisible();
  });

  test('should display organization selector', async ({ adminPage }) => {
    const orgSelect = adminPage.getByLabel('Organization');
    await expect(orgSelect).toBeVisible();

    // Should have default "Select organization" option
    await expect(adminPage.locator('option').filter({ hasText: 'Select organization' })).toBeVisible();
  });

  test('should validate required fields on submit', async ({ adminPage }) => {
    // Try to submit empty form
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Should show error message
    await expect(adminPage.getByText('Organization and name are required.')).toBeVisible();
  });

  test('should validate age range is numeric', async ({ adminPage }) => {
    // Fill required fields but leave age range empty
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });
    await adminPage.getByLabel('Name').fill('Test Activity');

    // Submit without age range
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Should show error message about age range
    await expect(adminPage.getByText('Age range must be numeric.')).toBeVisible();
  });

  test('should validate age min is less than age max', async ({ adminPage }) => {
    // Fill form with invalid age range
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });
    await adminPage.getByLabel('Name').fill('Test Activity');
    await adminPage.getByLabel('Age Min').fill('10');
    await adminPage.getByLabel('Age Max').fill('5'); // Max less than min

    // Submit
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Should show error message
    await expect(adminPage.getByText('Age min must be less than age max.')).toBeVisible();
  });

  test('should fill out the activity form', async ({ adminPage }) => {
    // Select organization
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });

    // Fill name
    await adminPage.getByLabel('Name').fill('New Test Activity');

    // Fill description
    await adminPage.getByLabel('Description').fill('This is a test activity description');

    // Fill age range
    await adminPage.getByLabel('Age Min').fill('3');
    await adminPage.getByLabel('Age Max').fill('12');

    // Verify form is filled
    await expect(adminPage.getByLabel('Name')).toHaveValue('New Test Activity');
    await expect(adminPage.getByLabel('Description')).toHaveValue(
      'This is a test activity description'
    );
    await expect(adminPage.getByLabel('Age Min')).toHaveValue('3');
    await expect(adminPage.getByLabel('Age Max')).toHaveValue('12');
  });

  test('should create a new activity', async ({ adminPage }) => {
    // Fill the form completely
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });
    await adminPage.getByLabel('Name').fill('New Swimming Class');
    await adminPage.getByLabel('Description').fill('Learn advanced swimming techniques');
    await adminPage.getByLabel('Age Min').fill('8');
    await adminPage.getByLabel('Age Max').fill('18');

    // Submit the form
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Form should be reset after successful creation
  });

  test('should show edit form when clicking Edit button', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Click Edit on first activity
    await adminPage.getByRole('row', { name: /Swimming Class/ }).getByRole('button', { name: 'Edit' }).click();

    // Cancel button should appear
    await expect(adminPage.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Submit button text should change
    await expect(adminPage.getByRole('button', { name: 'Update Activity' })).toBeVisible();
  });

  test('should populate form with existing data when editing', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Click Edit
    await adminPage.getByRole('row', { name: /Swimming Class/ }).getByRole('button', { name: 'Edit' }).click();

    // Form should be populated with existing data
    await expect(adminPage.getByLabel('Name')).toHaveValue('Swimming Class');
    await expect(adminPage.getByLabel('Description')).toHaveValue('Learn to swim');
    await expect(adminPage.getByLabel('Age Min')).toHaveValue('5');
    await expect(adminPage.getByLabel('Age Max')).toHaveValue('12');
  });

  test('should cancel editing and reset form', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Click Edit
    await adminPage.getByRole('row', { name: /Swimming Class/ }).getByRole('button', { name: 'Edit' }).click();

    // Verify we're in edit mode
    await expect(adminPage.getByRole('button', { name: 'Update Activity' })).toBeVisible();

    // Click Cancel
    await adminPage.getByRole('button', { name: 'Cancel' }).click();

    // Should return to "Add Activity" button
    await expect(adminPage.getByRole('button', { name: 'Add Activity' })).toBeVisible();

    // Form should be reset
    await expect(adminPage.getByLabel('Name')).toHaveValue('');
  });

  test('should have delete button for each activity', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Each row should have a Delete button
    const deleteButtons = adminPage.getByRole('button', { name: 'Delete' });
    await expect(deleteButtons).toHaveCount(2); // We have 2 mock activities
  });

  test('should display age range in the table', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Check age ranges are displayed
    await expect(adminPage.getByText('5 - 12')).toBeVisible(); // Swimming Class
    await expect(adminPage.getByText('3 - 10')).toBeVisible(); // Art Workshop
  });

  test('should have search input for activities', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Check for search input
    const searchInput = adminPage.getByPlaceholder('Search activities...');
    await expect(searchInput).toBeVisible();
  });

  test('should filter activities by search query', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();
    await expect(adminPage.getByText('Art Workshop')).toBeVisible();

    // Type in search
    const searchInput = adminPage.getByPlaceholder('Search activities...');
    await searchInput.fill('Swimming');

    // Should only show matching activity
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();
    await expect(adminPage.getByText('Art Workshop')).not.toBeVisible();
  });

  test('should show no results message when search has no matches', async ({ adminPage }) => {
    // Wait for the table to load
    await expect(adminPage.getByText('Swimming Class')).toBeVisible();

    // Type in search with no matches
    const searchInput = adminPage.getByPlaceholder('Search activities...');
    await searchInput.fill('NonexistentActivity');

    // Should show no results message
    await expect(adminPage.getByText('No activities match your search.')).toBeVisible();
  });
});

test.describe('Activities Panel - Form Validation', () => {
  test.beforeEach(async ({ adminPage }) => {
  await adminPage.goto('/admin/dashboard');
    await adminPage.getByRole('button', { name: 'Activities' }).click();
  });

  test('should accept valid age range with 0 as minimum', async ({ adminPage }) => {
    // Fill form with 0 as minimum age
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });
    await adminPage.getByLabel('Name').fill('Baby Activity');
    await adminPage.getByLabel('Age Min').fill('0');
    await adminPage.getByLabel('Age Max').fill('3');

    // Submit should work (no validation error about age range)
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Should not show age validation error
    await expect(adminPage.getByText('Age min must be less than age max.')).not.toBeVisible();
  });

  test('should reject equal age min and max', async ({ adminPage }) => {
    // Fill form with equal min and max
    await adminPage.getByLabel('Organization').selectOption({ index: 1 });
    await adminPage.getByLabel('Category').selectOption({ label: 'Sport' });
    await adminPage.getByLabel('Subcategory').selectOption({ label: 'Water Sports' });
    await adminPage.getByLabel('Name').fill('Test Activity');
    await adminPage.getByLabel('Age Min').fill('5');
    await adminPage.getByLabel('Age Max').fill('5');

    // Submit
    await adminPage.getByRole('button', { name: 'Add Activity' }).click();

    // Should show error message
    await expect(adminPage.getByText('Age min must be less than age max.')).toBeVisible();
  });

  test('should use number input for age fields', async ({ adminPage }) => {
    // Check that age inputs are type="number"
    const ageMinInput = adminPage.getByLabel('Age Min');
    const ageMaxInput = adminPage.getByLabel('Age Max');

    await expect(ageMinInput).toHaveAttribute('type', 'number');
    await expect(ageMaxInput).toHaveAttribute('type', 'number');
  });
});
