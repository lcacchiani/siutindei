import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

/**
 * Configuration for identity providers.
 */
export interface IdentityProviderConfig {
  google?: {
    clientId: string;
    clientSecret: string;
  };
  apple?: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
  };
  microsoft?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
}

/**
 * Properties for the AuthConstruct.
 */
export interface AuthConstructProps {
  /** Resource name prefix for naming resources. */
  resourcePrefix: string;
  /** Cognito domain prefix for hosted UI. */
  domainPrefix: string;
  /** OAuth callback URLs. */
  callbackUrls: string[];
  /** OAuth logout URLs. */
  logoutUrls: string[];
  /** Identity provider configuration. */
  identityProviders: IdentityProviderConfig;
  /** Lambda triggers for custom auth flow. */
  triggers?: {
    preSignUp?: lambda.IFunction;
    defineAuthChallenge?: lambda.IFunction;
    createAuthChallenge?: lambda.IFunction;
    verifyAuthChallengeResponse?: lambda.IFunction;
  };
}

/**
 * Construct for Cognito User Pool with federated identity providers.
 *
 * Creates:
 * - Cognito User Pool with email sign-in
 * - Google, Apple, and Microsoft identity providers
 * - User Pool Client with OAuth configuration
 * - Admin group
 */
export class AuthConstruct extends Construct {
  /** The Cognito User Pool. */
  public readonly userPool: cognito.UserPool;
  /** The User Pool Client (L1 construct for full control). */
  public readonly userPoolClient: cognito.CfnUserPoolClient;
  /** The admin group name. */
  public readonly adminGroupName = "admin";

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;

    // User Pool
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: name("user-pool"),
      signInAliases: { email: true },
      autoVerify: { email: true },
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Add Lambda triggers if provided
    if (props.triggers?.preSignUp) {
      this.userPool.addTrigger(
        cognito.UserPoolOperation.PRE_SIGN_UP,
        props.triggers.preSignUp
      );
    }
    if (props.triggers?.defineAuthChallenge) {
      this.userPool.addTrigger(
        cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
        props.triggers.defineAuthChallenge
      );
    }
    if (props.triggers?.createAuthChallenge) {
      this.userPool.addTrigger(
        cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
        props.triggers.createAuthChallenge
      );
    }
    if (props.triggers?.verifyAuthChallengeResponse) {
      this.userPool.addTrigger(
        cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
        props.triggers.verifyAuthChallengeResponse
      );
    }

    // Identity providers
    const providers: cognito.CfnUserPoolIdentityProvider[] = [];

    if (props.identityProviders.google) {
      const googleProvider = new cognito.CfnUserPoolIdentityProvider(
        this,
        "GoogleProvider",
        {
          providerName: "Google",
          providerType: "Google",
          userPoolId: this.userPool.userPoolId,
          attributeMapping: {
            email: "email",
            given_name: "given_name",
            family_name: "family_name",
          },
          providerDetails: {
            client_id: props.identityProviders.google.clientId,
            client_secret: props.identityProviders.google.clientSecret,
            authorize_scopes: "openid email profile",
          },
        }
      );
      providers.push(googleProvider);
    }

    if (props.identityProviders.apple) {
      const appleProvider = new cognito.CfnUserPoolIdentityProvider(
        this,
        "AppleProvider",
        {
          providerName: "SignInWithApple",
          providerType: "SignInWithApple",
          userPoolId: this.userPool.userPoolId,
          attributeMapping: {
            email: "email",
          },
          providerDetails: {
            client_id: props.identityProviders.apple.clientId,
            team_id: props.identityProviders.apple.teamId,
            key_id: props.identityProviders.apple.keyId,
            private_key: props.identityProviders.apple.privateKey,
            authorize_scopes: "name email",
          },
        }
      );
      providers.push(appleProvider);
    }

    if (props.identityProviders.microsoft) {
      const microsoftProvider = new cognito.CfnUserPoolIdentityProvider(
        this,
        "MicrosoftProvider",
        {
          providerName: "Microsoft",
          providerType: "OIDC",
          userPoolId: this.userPool.userPoolId,
          attributeMapping: {
            email: "email",
          },
          providerDetails: {
            client_id: props.identityProviders.microsoft.clientId,
            client_secret: props.identityProviders.microsoft.clientSecret,
            attributes_request_method: "GET",
            oidc_issuer: `https://login.microsoftonline.com/${props.identityProviders.microsoft.tenantId}/v2.0`,
            authorize_scopes: "openid email profile",
          },
        }
      );
      providers.push(microsoftProvider);
    }

    // User Pool Domain
    new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: props.domainPrefix,
      },
    });

    // Supported identity provider names
    const supportedProviders = ["COGNITO"];
    if (props.identityProviders.google) supportedProviders.push("Google");
    if (props.identityProviders.apple) supportedProviders.push("SignInWithApple");
    if (props.identityProviders.microsoft) supportedProviders.push("Microsoft");

    // User Pool Client
    this.userPoolClient = new cognito.CfnUserPoolClient(this, "UserPoolClient", {
      clientName: name("user-pool-client"),
      userPoolId: this.userPool.userPoolId,
      generateSecret: false,
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthFlows: ["code"],
      allowedOAuthScopes: ["openid", "email", "profile"],
      callbackUrLs: props.callbackUrls,
      logoutUrLs: props.logoutUrls,
      supportedIdentityProviders: supportedProviders,
      explicitAuthFlows: ["ALLOW_CUSTOM_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    });

    // Add dependencies on identity providers
    for (const provider of providers) {
      this.userPoolClient.addDependency(provider);
    }

    // Admin group
    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: this.adminGroupName,
      description: "Administrative users",
    });
  }
}
