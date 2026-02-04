import { test as base, Page } from '@playwright/test';

/**
 * Mock user data for testing different auth states
 */
export interface MockUser {
  email: string;
  sub: string;
  groups: string[];
  name?: string;
}

export const mockAdminUser: MockUser = {
  email: 'admin@example.com',
  sub: 'admin-user-id-123',
  groups: ['admin'],
  name: 'Admin User',
};

export const mockManagerUser: MockUser = {
  email: 'manager@example.com',
  sub: 'manager-user-id-456',
  groups: ['manager'],
  name: 'Manager User',
};

export const mockAdminManagerUser: MockUser = {
  email: 'admin-manager@example.com',
  sub: 'admin-manager-id-789',
  groups: ['admin', 'manager'],
  name: 'Admin Manager User',
};

export const mockRegularUser: MockUser = {
  email: 'user@example.com',
  sub: 'regular-user-id-000',
  groups: [],
  name: 'Regular User',
};

/**
 * Creates a mock JWT token payload for testing
 */
function createMockIdToken(user: MockUser): string {
  const payload = {
    sub: user.sub,
    email: user.email,
    'cognito:groups': user.groups,
    name: user.name,
    email_verified: true,
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_mock',
    aud: 'mock-client-id-12345',
    token_use: 'id',
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
  };

  // Simple base64 encoding (not a real JWT, but sufficient for testing)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa('mock-signature');

  return `${header}.${body}.${signature}`;
}

/**
 * Creates mock tokens object for localStorage
 */
function createMockTokens(user: MockUser) {
  return {
    access_token: 'mock-access-token-' + user.sub,
    id_token: createMockIdToken(user),
    refresh_token: 'mock-refresh-token-' + user.sub,
    token_type: 'Bearer',
    expires_in: 3600,
  };
}

/**
 * Mock organization data
 */
export const mockOrganizations = [
  {
    id: 'org-1',
    name: 'Test Organization 1',
    description: 'First test organization',
    manager_id: 'manager-user-id-456',
    media_urls: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'org-2',
    name: 'Test Organization 2',
    description: 'Second test organization',
    manager_id: 'admin-manager-id-789',
    media_urls: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

/**
 * Mock activities data
 */
export const mockActivities = [
  {
    id: 'activity-1',
    org_id: 'org-1',
    name: 'Swimming Class',
    description: 'Learn to swim',
    age_min: 5,
    age_max: 12,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    org_id: 'org-1',
    name: 'Art Workshop',
    description: 'Creative art activities',
    age_min: 3,
    age_max: 10,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

/**
 * Mock Cognito users data
 */
export const mockCognitoUsers = [
  {
    sub: 'manager-user-id-456',
    username: 'manager@example.com',
    email: 'manager@example.com',
    name: 'Manager User',
    enabled: true,
    status: 'CONFIRMED',
    groups: ['manager'],
  },
  {
    sub: 'admin-manager-id-789',
    username: 'admin-manager@example.com',
    email: 'admin-manager@example.com',
    name: 'Admin Manager User',
    enabled: true,
    status: 'CONFIRMED',
    groups: ['admin', 'manager'],
  },
];

/**
 * Mock locations data
 */
export const mockLocations = [
  {
    id: 'loc-1',
    org_id: 'org-1',
    name: 'Main Center',
    address: '123 Test Street',
    city: 'Test City',
    postal_code: '12345',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

/**
 * Mock access requests data
 */
export const mockAccessRequests = [
  {
    id: 'request-1',
    user_sub: 'pending-user-id',
    user_email: 'pending@example.com',
    organization_name: 'New Organization',
    message: 'Please approve my request',
    status: 'pending',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

/**
 * Sets up authentication state in the browser for a given user
 */
export async function setupAuth(page: Page, user: MockUser | null): Promise<void> {
  if (user) {
    const tokens = createMockTokens(user);
    await page.addInitScript((tokensStr) => {
      localStorage.setItem('auth_tokens', tokensStr);
    }, JSON.stringify(tokens));
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem('auth_tokens');
    });
  }
}

/**
 * Sets up API mocks for common endpoints
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Mock organizations list
  await page.route('**/api/mock/admin/organizations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockOrganizations, cursor: null }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      const newOrg = {
        id: 'org-new-' + Date.now(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newOrg),
      });
    } else {
      await route.continue();
    }
  });

  // Mock organization by ID
  await page.route('**/api/mock/admin/organizations/*', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      await route.fulfill({
        status: 204,
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      const body = route.request().postDataJSON();
      const orgId = route.request().url().split('/').pop();
      const updatedOrg = {
        id: orgId,
        ...body,
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updatedOrg),
      });
    } else {
      await route.continue();
    }
  });

  // Mock activities list
  await page.route('**/api/mock/admin/activities*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockActivities, cursor: null }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      const newActivity = {
        id: 'activity-new-' + Date.now(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newActivity),
      });
    } else {
      await route.continue();
    }
  });

  // Mock locations list
  await page.route('**/api/mock/admin/locations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockLocations, cursor: null }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock Cognito users list
  await page.route('**/api/mock/admin/cognito/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockCognitoUsers, pagination_token: null }),
    });
  });

  // Mock access requests list
  await page.route('**/api/mock/admin/access-requests*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockAccessRequests, cursor: null }),
    });
  });

  // Mock user access request status endpoint
  await page.route('**/api/mock/user/access-request*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizations_count: mockOrganizations.length,
        has_pending_request: false,
        pending_request: null,
      }),
    });
  });

  // Mock manager organizations list
  await page.route('**/api/mock/manager/organizations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockOrganizations.slice(0, 1), cursor: null }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock pricing list
  await page.route('**/api/mock/admin/pricing*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], cursor: null }),
    });
  });

  // Mock schedules list
  await page.route('**/api/mock/admin/schedules*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], cursor: null }),
    });
  });

  // Mock media upload
  await page.route('**/api/mock/admin/media*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], cursor: null }),
    });
  });
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
  managerPage: Page;
  unauthenticatedPage: Page;
}>({
  // Authenticated page with admin user
  authenticatedPage: async ({ page }, use) => {
    await setupAuth(page, mockAdminUser);
    await setupApiMocks(page);
    await use(page);
  },

  // Admin page specifically
  adminPage: async ({ page }, use) => {
    await setupAuth(page, mockAdminUser);
    await setupApiMocks(page);
    await use(page);
  },

  // Manager page (non-admin manager)
  managerPage: async ({ page }, use) => {
    await setupAuth(page, mockManagerUser);
    await setupApiMocks(page);
    await use(page);
  },

  // Unauthenticated page
  unauthenticatedPage: async ({ page }, use) => {
    await setupAuth(page, null);
    await use(page);
  },
});

export { expect } from '@playwright/test';
