/**
 * Passwordless authentication using Cognito Custom Auth flow.
 *
 * This module handles email OTP authentication by triggering the
 * custom auth Lambda triggers configured in the Cognito User Pool.
 */

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

import { appConfig } from './config';

export interface PasswordlessTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export type PasswordlessAuthState =
  | { status: 'idle' }
  | { status: 'sending'; email: string }
  | { status: 'challenge'; email: string; cognitoUser: CognitoUser }
  | { status: 'verifying'; email: string }
  | { status: 'success'; tokens: PasswordlessTokens }
  | { status: 'error'; message: string };

function getUserPool(): CognitoUserPool {
  const userPoolId = appConfig.cognitoUserPoolId.trim();
  const clientId = appConfig.cognitoClientId.trim();

  if (!userPoolId || !clientId) {
    throw new Error('Cognito User Pool ID or Client ID is not configured.');
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
  });
}

function sessionToTokens(session: CognitoUserSession): PasswordlessTokens {
  const accessToken = session.getAccessToken();
  const idToken = session.getIdToken();
  const refreshToken = session.getRefreshToken();

  return {
    accessToken: accessToken.getJwtToken(),
    idToken: idToken.getJwtToken(),
    refreshToken: refreshToken?.getToken(),
    expiresAt: accessToken.getExpiration() * 1000,
  };
}

/**
 * Initiates passwordless sign-in by sending an OTP code to the user's email.
 * Returns a CognitoUser instance needed for the challenge response.
 */
export function initiatePasswordlessSignIn(
  email: string
): Promise<CognitoUser> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();

    const cognitoUser = new CognitoUser({
      Username: email.toLowerCase().trim(),
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email.toLowerCase().trim(),
    });

    cognitoUser.setAuthenticationFlowType('CUSTOM_AUTH');

    cognitoUser.initiateAuth(authDetails, {
      onSuccess: () => {
        // This shouldn't happen for custom auth - we expect a challenge
        reject(new Error('Unexpected authentication success without challenge.'));
      },
      onFailure: (err) => {
        reject(err);
      },
      customChallenge: () => {
        // Challenge issued - OTP has been sent to the user's email
        resolve(cognitoUser);
      },
    });
  });
}

/**
 * Responds to the custom auth challenge with the OTP code.
 * Returns the authentication tokens on success.
 */
export function respondToPasswordlessChallenge(
  cognitoUser: CognitoUser,
  code: string
): Promise<PasswordlessTokens> {
  return new Promise((resolve, reject) => {
    cognitoUser.sendCustomChallengeAnswer(code.trim(), {
      onSuccess: (session) => {
        resolve(sessionToTokens(session));
      },
      onFailure: (err) => {
        reject(err);
      },
      customChallenge: () => {
        // Another challenge issued - likely wrong code, retry allowed
        reject(new Error('Invalid code. Please try again.'));
      },
    });
  });
}

/**
 * Signs up a new user with just their email (no password).
 * The user will be auto-confirmed via the pre-signup Lambda trigger.
 */
export function signUpPasswordlessUser(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const normalizedEmail = email.toLowerCase().trim();

    // For passwordless, we generate a random password that won't be used
    // The user authenticates via custom auth (OTP) instead
    const randomPassword = generateSecurePassword();

    const emailAttribute = new CognitoUserAttribute({
      Name: 'email',
      Value: normalizedEmail,
    });

    userPool.signUp(
      normalizedEmail,
      randomPassword,
      [emailAttribute],
      [],
      (err) => {
        if (err) {
          // If user already exists, that's fine - they can just sign in
          if (err.name === 'UsernameExistsException') {
            resolve();
            return;
          }
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

/**
 * Generates a secure random password for passwordless sign-up.
 * This password is never used - authentication is via OTP.
 */
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}
