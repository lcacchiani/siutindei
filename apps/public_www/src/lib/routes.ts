export const ROUTES = {
  home: '/',
  about: '/about',
} as const;

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const INDEXED_ROUTE_PATHS: readonly AppRoutePath[] = [
  ROUTES.home,
  ROUTES.about,
];
