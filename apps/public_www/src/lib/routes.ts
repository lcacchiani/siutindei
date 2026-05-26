export const ROUTES = {
  home: '/',
  about: '/about',
  search: '/search',
  activity: '/activity',
  privacy: '/privacy',
  terms: '/terms',
} as const;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const INDEXED_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.home,
  ROUTES.about,
  ROUTES.search,
  ROUTES.privacy,
  ROUTES.terms,
];
