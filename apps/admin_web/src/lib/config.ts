export interface AppConfig {
  apiBaseUrl: string;
  cognitoDomain: string;
  cognitoClientId: string;
  cognitoUserPoolId: string;
  scheduleDefaultDurationMinutes: number;
}

const defaultScheduleDurationMinutes = 60;
const minutesPerDay = 24 * 60;

function parseDurationMinutes(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed <= 0 || parsed >= minutesPerDay) {
    return null;
  }
  return Math.round(parsed);
}

export const appConfig: AppConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  scheduleDefaultDurationMinutes:
    parseDurationMinutes(
      process.env.NEXT_PUBLIC_SCHEDULE_DEFAULT_DURATION_MINUTES
    ) ?? defaultScheduleDurationMinutes,
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export function getConfigErrors() {
  const errors: string[] = [];
  if (!appConfig.apiBaseUrl) {
    errors.push('NEXT_PUBLIC_API_BASE_URL is missing.');
  }
  if (!appConfig.cognitoDomain) {
    errors.push('NEXT_PUBLIC_COGNITO_DOMAIN is missing.');
  }
  if (!appConfig.cognitoClientId) {
    errors.push('NEXT_PUBLIC_COGNITO_CLIENT_ID is missing.');
  }
  if (!appConfig.cognitoUserPoolId) {
    errors.push('NEXT_PUBLIC_COGNITO_USER_POOL_ID is missing.');
  }
  return errors;
}

export function getCognitoDomain() {
  const trimmed = appConfig.cognitoDomain.trim();
  if (!trimmed) {
    throw new Error('Cognito domain is not configured.');
  }
  const withScheme = trimmed.startsWith('http')
    ? trimmed
    : `https://${trimmed}`;
  return trimTrailingSlashes(withScheme);
}

export function getApiBaseUrl() {
  const trimmed = appConfig.apiBaseUrl.trim();
  if (!trimmed) {
    throw new Error('API base URL is not configured.');
  }
  return trimTrailingSlashes(trimmed);
}
