import { test as base, Page, Route } from '@playwright/test';

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
    accessToken: 'mock-access-token-' + user.sub,
    idToken: createMockIdToken(user),
    refreshToken: 'mock-refresh-token-' + user.sub,
    expiresAt: Date.now() + 3600 * 1000,
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
    name_translations: {
      en: 'Test Organization 1',
      zh: 'Test Organization 1 (zh)',
      yue: 'Test Organization 1 (yue)',
    },
    description_translations: {
      en: 'First test organization',
      zh: 'First test organization (zh)',
      yue: 'First test organization (yue)',
    },
    manager_id: 'manager-user-id-456',
    phone_country_code: 'HK',
    phone_number: '12345678',
    email: 'contact@org-one.test',
    whatsapp: '@orgone',
    facebook: 'https://facebook.com/orgone',
    instagram: '@orgone',
    tiktok: '@orgone',
    twitter: '@orgone',
    xiaohongshu: '@orgone',
    wechat: '@orgone',
    media_urls: [],
    logo_media_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'org-2',
    name: 'Test Organization 2',
    description: 'Second test organization',
    name_translations: {
      en: 'Test Organization 2',
      zh: 'Test Organization 2 (zh)',
      yue: 'Test Organization 2 (yue)',
    },
    description_translations: {
      en: 'Second test organization',
      zh: 'Second test organization (zh)',
      yue: 'Second test organization (yue)',
    },
    manager_id: 'admin-manager-id-789',
    phone_country_code: 'HK',
    phone_number: '87654321',
    email: 'contact@org-two.test',
    whatsapp: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    twitter: '',
    xiaohongshu: '',
    wechat: '',
    media_urls: [],
    logo_media_url: null,
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
    category_id: 'cat-water',
    name: 'Swimming Class',
    description: 'Learn to swim',
    name_translations: {
      en: 'Swimming Class',
      zh: 'Swimming Class (zh)',
      yue: 'Swimming Class (yue)',
    },
    description_translations: {
      en: 'Learn to swim',
      zh: 'Learn to swim (zh)',
      yue: 'Learn to swim (yue)',
    },
    age_min: 5,
    age_max: 12,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    org_id: 'org-1',
    category_id: 'cat-paint',
    name: 'Art Workshop',
    description: 'Creative art activities',
    name_translations: {
      en: 'Art Workshop',
      zh: 'Art Workshop (zh)',
      yue: 'Art Workshop (yue)',
    },
    description_translations: {
      en: 'Creative art activities',
      zh: 'Creative art activities (zh)',
      yue: 'Creative art activities (yue)',
    },
    age_min: 3,
    age_max: 10,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

export const mockActivityCategoryTree = [
  {
    id: 'cat-sport',
    parent_id: null,
    name: 'Sport',
    name_translations: {
      en: 'Sport',
      zh: 'Sport (zh)',
      yue: 'Sport (yue)',
    },
    display_order: 1,
    children: [
      {
        id: 'cat-water',
        parent_id: 'cat-sport',
        name: 'Water Sports',
        name_translations: {
          en: 'Water Sports',
          zh: 'Water Sports (zh)',
          yue: 'Water Sports (yue)',
        },
        display_order: 1,
        children: [],
      },
      {
        id: 'cat-team',
        parent_id: 'cat-sport',
        name: 'Team Sports',
        name_translations: {
          en: 'Team Sports',
          zh: 'Team Sports (zh)',
          yue: 'Team Sports (yue)',
        },
        display_order: 2,
        children: [],
      },
    ],
  },
  {
    id: 'cat-arts',
    parent_id: null,
    name: 'Arts',
    name_translations: {
      en: 'Arts',
      zh: 'Arts (zh)',
      yue: 'Arts (yue)',
    },
    display_order: 2,
    children: [
      {
        id: 'cat-paint',
        parent_id: 'cat-arts',
        name: 'Painting',
        name_translations: {
          en: 'Painting',
          zh: 'Painting (zh)',
          yue: 'Painting (yue)',
        },
        display_order: 1,
        children: [],
      },
    ],
  },
];

export const mockActivityCategories = [
  {
    id: 'cat-sport',
    parent_id: null,
    name: 'Sport',
    name_translations: {
      en: 'Sport',
      zh: 'Sport (zh)',
      yue: 'Sport (yue)',
    },
    display_order: 1,
    children: [],
  },
  {
    id: 'cat-water',
    parent_id: 'cat-sport',
    name: 'Water Sports',
    name_translations: {
      en: 'Water Sports',
      zh: 'Water Sports (zh)',
      yue: 'Water Sports (yue)',
    },
    display_order: 1,
    children: [],
  },
  {
    id: 'cat-team',
    parent_id: 'cat-sport',
    name: 'Team Sports',
    name_translations: {
      en: 'Team Sports',
      zh: 'Team Sports (zh)',
      yue: 'Team Sports (yue)',
    },
    display_order: 2,
    children: [],
  },
  {
    id: 'cat-arts',
    parent_id: null,
    name: 'Arts',
    name_translations: {
      en: 'Arts',
      zh: 'Arts (zh)',
      yue: 'Arts (yue)',
    },
    display_order: 2,
    children: [],
  },
  {
    id: 'cat-paint',
    parent_id: 'cat-arts',
    name: 'Painting',
    name_translations: {
      en: 'Painting',
      zh: 'Painting (zh)',
      yue: 'Painting (yue)',
    },
    display_order: 1,
    children: [],
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
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_auth_time: '2024-01-10T00:00:00Z',
    attributes: {
      email: 'manager@example.com',
      name: 'Manager User',
      'custom:feedback_stars': '2',
    },
  },
  {
    sub: 'admin-manager-id-789',
    username: 'admin-manager@example.com',
    email: 'admin-manager@example.com',
    name: 'Admin Manager User',
    enabled: true,
    status: 'CONFIRMED',
    groups: ['admin', 'manager'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_auth_time: '2024-01-12T00:00:00Z',
    attributes: {
      email: 'admin-manager@example.com',
      name: 'Admin Manager User',
      'custom:feedback_stars': '5',
    },
  },
];

/**
 * Mock locations data
 */
export const mockLocations = [
  {
    id: 'loc-1',
    org_id: 'org-1',
    area_id: 'area-hk-wanchai',
    address: '123 Test Street',
    lat: 22.278,
    lng: 114.175,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

export const mockAreaTree = [
  {
    id: 'area-hk',
    parent_id: null,
    name: 'Hong Kong',
    name_translations: {
      en: 'Hong Kong',
      zh: 'Hong Kong (zh)',
      yue: 'Hong Kong (yue)',
    },
    level: 'country',
    code: 'HK',
    active: true,
    display_order: 1,
    children: [
      {
        id: 'area-hk-wanchai',
        parent_id: 'area-hk',
        name: 'Wan Chai',
        name_translations: {
          en: 'Wan Chai',
          zh: 'Wan Chai (zh)',
          yue: 'Wan Chai (yue)',
        },
        level: 'district',
        code: null,
        active: true,
        display_order: 1,
        children: [],
      },
    ],
  },
];

/**
 * Mock tickets data
 */
export const mockTickets = [
  {
    id: 'ticket-1',
    ticket_id: 'T00001',
    ticket_type: 'access_request',
    submitter_id: 'pending-user-id',
    submitter_email: 'pending@example.com',
    organization_name: 'New Organization',
    status: 'pending',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    admin_notes: null,
  },
];

export const mockFeedbackLabels = [
  {
    id: 'label-friendly',
    name: 'Friendly staff',
    name_translations: { zh: '親切職員', yue: '親切職員' },
    display_order: 0,
  },
  {
    id: 'label-clean',
    name: 'Clean space',
    name_translations: { zh: '乾淨環境', yue: '乾淨環境' },
    display_order: 1,
  },
];

export const mockOrganizationFeedback = [
  {
    id: 'feedback-1',
    organization_id: 'org-1',
    organization_name: 'Test Organization 1',
    submitter_id: 'regular-user-id-000',
    submitter_email: 'user@example.com',
    stars: 4,
    label_ids: ['label-friendly'],
    description: 'Great staff and friendly environment.',
    source_ticket_id: 'F00001',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
];

/**
 * Sets up authentication state in the browser for a given user
 */
export async function setupAuth(page: Page, user: MockUser | null): Promise<void> {
  if (user) {
    const tokens = createMockTokens(user);
    await page.addInitScript((tokensStr) => {
      localStorage.setItem('admin_auth_tokens', tokensStr);
    }, JSON.stringify(tokens));
  } else {
    await page.addInitScript(() => {
      localStorage.removeItem('admin_auth_tokens');
    });
  }
}

/**
 * Sets up API mocks for common endpoints
 */
export async function setupApiMocks(page: Page): Promise<void> {
  // Mock organizations list
  await page.route('**/api/mock/**/admin/organizations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockOrganizations, next_cursor: null }),
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
  await page.route('**/api/mock/**/admin/organizations/*', async (route) => {
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
  await page.route('**/api/mock/**/admin/activities*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockActivities, next_cursor: null }),
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

  // Mock activity categories list
  await page.route('**/api/mock/**/admin/activity-categories*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockActivityCategories, next_cursor: null }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      const newCategory = {
        id: 'category-new-' + Date.now(),
        ...body,
        children: [],
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newCategory),
      });
    } else {
      await route.continue();
    }
  });

  // Mock feedback labels list
  const handleFeedbackLabels = async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockFeedbackLabels, next_cursor: null }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      const newLabel = {
        id: 'label-new-' + Date.now(),
        ...body,
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newLabel),
      });
    } else {
      await route.continue();
    }
  };
  await page.route(
    '**/api/mock/**/admin/feedback-labels',
    handleFeedbackLabels
  );
  await page.route(
    '**/api/mock/**/admin/feedback-labels?*',
    handleFeedbackLabels
  );

  // Mock feedback label by ID
  await page.route('**/api/mock/**/admin/feedback-labels/*', async (route) => {
    const method = route.request().method();
    const labelId = route.request().url().split('/').pop()?.split('?')[0];
    if (method === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const updated = {
        id: labelId,
        ...body,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
    } else {
      await route.continue();
    }
  });

  // Mock organization feedback list
  const handleOrganizationFeedback = async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockOrganizationFeedback,
          next_cursor: null,
        }),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON();
      const created = {
        id: 'feedback-new-' + Date.now(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    } else {
      await route.continue();
    }
  };
  await page.route(
    '**/api/mock/**/admin/organization-feedback',
    handleOrganizationFeedback
  );
  await page.route(
    '**/api/mock/**/admin/organization-feedback?*',
    handleOrganizationFeedback
  );

  // Mock organization feedback by ID
  await page.route(
    '**/api/mock/**/admin/organization-feedback/*',
    async (route) => {
      const method = route.request().method();
      const feedbackId = route.request().url().split('/').pop()?.split('?')[0];
      if (method === 'DELETE') {
        await route.fulfill({ status: 204 });
      } else if (method === 'PUT') {
        const body = route.request().postDataJSON();
        const updated = {
          id: feedbackId,
          ...body,
          updated_at: new Date().toISOString(),
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        });
      } else {
        await route.continue();
      }
    }
  );

  // Mock activity category by ID
  await page.route(
    '**/api/mock/**/admin/activity-categories/*',
    async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      const categoryId = url.split('/').pop()?.split('?')[0];

      if (method === 'DELETE') {
        await route.fulfill({
          status: 204,
        });
      } else if (method === 'PUT') {
        const body = route.request().postDataJSON();
        const updatedCategory = {
          id: categoryId,
          ...body,
          children: [],
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updatedCategory),
        });
      } else {
        await route.continue();
      }
    }
  );

  // Mock activity category tree (user endpoint)
  await page.route(
    '**/api/mock/**/user/activity-categories*',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockActivityCategoryTree }),
      });
    }
  );

  // Mock geographic areas tree (user endpoint)
  await page.route('**/api/mock/**/user/areas*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockAreaTree }),
    });
  });

  // Mock feedback labels (user endpoint)
  await page.route('**/api/mock/**/user/feedback-labels*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockFeedbackLabels }),
    });
  });

  // Mock organization search (user endpoint)
  await page.route('**/api/mock/**/user/organizations*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockOrganizations }),
    });
  });

  // Mock locations list
  await page.route('**/api/mock/**/admin/locations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockLocations, next_cursor: null }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock Cognito users list
  await page.route('**/api/mock/**/admin/cognito-users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockCognitoUsers, pagination_token: null }),
    });
  });

  // Mock tickets list and review
  await page.route('**/api/mock/**/admin/tickets*', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockTickets, next_cursor: null }),
      });
      return;
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      const url = route.request().url();
      const ticketId = url.split('/').pop()?.split('?')[0];
      const existing = mockTickets.find((ticket) => ticket.id === ticketId);
      const updated = {
        ...(existing ?? mockTickets[0]),
        id: ticketId ?? mockTickets[0].id,
        status: body.action === 'approve' ? 'approved' : 'rejected',
        admin_notes: body.admin_notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'admin-user-id-123',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Ticket reviewed', ticket: updated }),
      });
      return;
    }
    await route.continue();
  });

  // Mock user access request status endpoint
  await page.route('**/api/mock/**/user/access-request*', async (route) => {
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

  // Mock user organization suggestions endpoint
  await page.route('**/api/mock/**/user/organization-suggestion*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ has_pending_suggestion: false, suggestions: [] }),
    });
  });

  // Mock user organization feedback endpoint
  await page.route(
    '**/api/mock/**/user/organization-feedback*',
    async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Feedback submitted',
            ticket_id: 'F00001',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ has_pending_feedback: false, feedbacks: [] }),
      });
    }
  );

  // Mock manager organizations list
  await page.route('**/api/mock/**/manager/organizations*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockOrganizations.slice(0, 1),
          next_cursor: null,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock manager activities list
  await page.route('**/api/mock/**/manager/activities*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockActivities, next_cursor: null }),
    });
  });

  // Mock manager locations list
  await page.route('**/api/mock/**/manager/locations*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: mockLocations, next_cursor: null }),
    });
  });

  // Mock manager pricing list
  await page.route('**/api/mock/**/manager/pricing*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  // Mock manager schedules list
  await page.route('**/api/mock/**/manager/schedules*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  // Mock pricing list
  await page.route('**/api/mock/**/admin/pricing*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  // Mock schedules list
  await page.route('**/api/mock/**/admin/schedules*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  // Mock audit logs list
  await page.route('**/api/mock/**/admin/audit-logs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
    });
  });

  // Mock media upload
  await page.route('**/api/mock/**/admin/media*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], next_cursor: null }),
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
