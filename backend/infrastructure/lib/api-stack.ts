import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as customresources from "aws-cdk-lib/custom-resources";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { DatabaseConstruct, PythonLambdaFactory } from "./constructs";

export class ApiStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "LX Software");
    cdk.Tags.of(this).add("Project", "Siu Tin Dei");

    const resourcePrefix = "lxsoftware-siutindei";
    const name = (suffix: string) => `${resourcePrefix}-${suffix}`;

    // ---------------------------------------------------------------------
    // VPC and Security Groups
    // ---------------------------------------------------------------------
    const vpc = new ec2.Vpc(this, "SiutindeiVpc", {
      vpcName: name("vpc"),
      maxAzs: 2,
      natGateways: 1,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      "LambdaSecurityGroup",
      {
        vpc,
        allowAllOutbound: true,
        securityGroupName: name("lambda-sg"),
      }
    );

    const migrationSecurityGroup = new ec2.SecurityGroup(
      this,
      "MigrationSecurityGroup",
      {
        vpc,
        allowAllOutbound: true,
        securityGroupName: name("migration-sg"),
      }
    );

    // ---------------------------------------------------------------------
    // Database (Aurora PostgreSQL Serverless v2 + RDS Proxy)
    // ---------------------------------------------------------------------
    const database = new DatabaseConstruct(this, "Database", {
      resourcePrefix,
      vpc,
      minCapacity: 0.5,
      maxCapacity: 2,
      databaseName: "siutindei",
    });

    // Allow Lambda access to database via proxy
    database.allowFrom(lambdaSecurityGroup, "Lambda access to RDS Proxy");

    // Allow migration Lambda direct access to database
    database.allowDirectAccessFrom(
      migrationSecurityGroup,
      "Migration Lambda direct access to Aurora"
    );

    // ---------------------------------------------------------------------
    // CloudFormation Parameters
    // ---------------------------------------------------------------------
    const authDomainPrefix = new cdk.CfnParameter(this, "CognitoDomainPrefix", {
      type: "String",
      description: "Hosted UI domain prefix for the Cognito user pool",
    });
    const oauthCallbackUrls = new cdk.CfnParameter(this, "CognitoCallbackUrls", {
      type: "CommaDelimitedList",
      description: "Comma-separated list of OAuth callback URLs",
    });
    const oauthLogoutUrls = new cdk.CfnParameter(this, "CognitoLogoutUrls", {
      type: "CommaDelimitedList",
      description: "Comma-separated list of OAuth logout URLs",
    });
    const googleClientId = new cdk.CfnParameter(this, "GoogleClientId", {
      type: "String",
      description: "Google OAuth client ID",
    });
    const googleClientSecret = new cdk.CfnParameter(this, "GoogleClientSecret", {
      type: "String",
      noEcho: true,
      description: "Google OAuth client secret",
    });
    const appleClientId = new cdk.CfnParameter(this, "AppleClientId", {
      type: "String",
      description: "Apple Services ID (Client ID)",
    });
    const appleTeamId = new cdk.CfnParameter(this, "AppleTeamId", {
      type: "String",
      description: "Apple developer team ID",
    });
    const appleKeyId = new cdk.CfnParameter(this, "AppleKeyId", {
      type: "String",
      description: "Apple Sign In key ID",
    });
    const applePrivateKey = new cdk.CfnParameter(this, "ApplePrivateKey", {
      type: "String",
      noEcho: true,
      description: "Apple Sign In private key",
    });
    const applePrivateKeyValue = cdk.Fn.join(
      "\n",
      cdk.Fn.split("\\n", applePrivateKey.valueAsString)
    );
    const microsoftTenantId = new cdk.CfnParameter(this, "MicrosoftTenantId", {
      type: "String",
      description: "Microsoft Entra tenant ID",
    });
    const microsoftClientId = new cdk.CfnParameter(this, "MicrosoftClientId", {
      type: "String",
      description: "Microsoft OAuth client ID",
    });
    const microsoftClientSecret = new cdk.CfnParameter(
      this,
      "MicrosoftClientSecret",
      {
        type: "String",
        noEcho: true,
        description: "Microsoft OAuth client secret",
      }
    );
    const authEmailFromAddress = new cdk.CfnParameter(
      this,
      "AuthEmailFromAddress",
      {
        type: "String",
        description: "SES-verified from address for passwordless emails",
      }
    );
    const loginLinkBaseUrl = new cdk.CfnParameter(this, "LoginLinkBaseUrl", {
      type: "String",
      default: "",
      description:
        "Optional base URL for magic links (adds email+code query params)",
    });
    const maxChallengeAttempts = new cdk.CfnParameter(
      this,
      "MaxChallengeAttempts",
      {
        type: "Number",
        default: 3,
        description: "Maximum passwordless auth attempts before failing",
      }
    );
    const publicApiKeyValue = new cdk.CfnParameter(this, "PublicApiKeyValue", {
      type: "String",
      noEcho: true,
      minLength: 20,
      constraintDescription:
        "Must be at least 20 characters to satisfy API Gateway API key requirements.",
      description: "API key value required for mobile activity search",
    });
    const deviceAttestationJwksUrl = new cdk.CfnParameter(
      this,
      "DeviceAttestationJwksUrl",
      {
        type: "String",
        default: "",
        description: "JWKS URL for device attestation token verification",
      }
    );
    const deviceAttestationIssuer = new cdk.CfnParameter(
      this,
      "DeviceAttestationIssuer",
      {
        type: "String",
        default: "",
        description: "Expected issuer for device attestation tokens",
      }
    );
    const deviceAttestationAudience = new cdk.CfnParameter(
      this,
      "DeviceAttestationAudience",
      {
        type: "String",
        default: "",
        description: "Expected audience for device attestation tokens",
      }
    );
    const corsAllowedOrigins = new cdk.CfnParameter(this, "CorsAllowedOrigins", {
      type: "CommaDelimitedList",
      default: "",
      description:
        "Comma-separated list of allowed CORS origins (e.g., https://app.example.com). " +
        "If empty, defaults to mobile app origins only. " +
        "SECURITY: Never use '*' in production.",
    });
    const deviceAttestationFailClosed = new cdk.CfnParameter(
      this,
      "DeviceAttestationFailClosed",
      {
        type: "String",
        default: "true",
        allowedValues: ["true", "false"],
        description:
          "If true, deny requests when attestation is not configured (production mode). " +
          "If false, allow requests without attestation (development mode). " +
          "SECURITY: Must be 'true' in production.",
      }
    );

    // ---------------------------------------------------------------------
    // Cognito User Pool and Identity Providers
    // ---------------------------------------------------------------------
    const userPool = new cognito.UserPool(this, "SiutindeiUserPool", {
      userPoolName: name("user-pool"),
      signInAliases: { email: true },
      autoVerify: { email: true },
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const googleProvider = new cognito.CfnUserPoolIdentityProvider(
      this,
      "GoogleIdentityProvider",
      {
        providerName: "Google",
        providerType: "Google",
        userPoolId: userPool.userPoolId,
        attributeMapping: {
          email: "email",
          given_name: "given_name",
          family_name: "family_name",
        },
        providerDetails: {
          client_id: googleClientId.valueAsString,
          client_secret: googleClientSecret.valueAsString,
          authorize_scopes: "openid email profile",
        },
      }
    );

    const appleProvider = new cognito.CfnUserPoolIdentityProvider(
      this,
      "AppleIdentityProvider",
      {
        providerName: "SignInWithApple",
        providerType: "SignInWithApple",
        userPoolId: userPool.userPoolId,
        attributeMapping: {
          email: "email",
        },
        providerDetails: {
          client_id: appleClientId.valueAsString,
          team_id: appleTeamId.valueAsString,
          key_id: appleKeyId.valueAsString,
          private_key: applePrivateKeyValue,
          authorize_scopes: "name email",
        },
      }
    );

    const microsoftProvider = new cognito.CfnUserPoolIdentityProvider(
      this,
      "MicrosoftIdentityProvider",
      {
        providerName: "Microsoft",
        providerType: "OIDC",
        userPoolId: userPool.userPoolId,
        attributeMapping: {
          email: "email",
        },
        providerDetails: {
          client_id: microsoftClientId.valueAsString,
          client_secret: microsoftClientSecret.valueAsString,
          attributes_request_method: "GET",
          oidc_issuer: `https://login.microsoftonline.com/${microsoftTenantId.valueAsString}/v2.0`,
          authorize_scopes: "openid email profile",
        },
      }
    );

    new cognito.UserPoolDomain(this, "SiutindeiUserPoolDomain", {
      userPool,
      cognitoDomain: {
        domainPrefix: authDomainPrefix.valueAsString,
      },
    });

    const userPoolClient = new cognito.CfnUserPoolClient(
      this,
      "SiutindeiUserPoolClient",
      {
        clientName: name("user-pool-client"),
        userPoolId: userPool.userPoolId,
        generateSecret: false,
        allowedOAuthFlowsUserPoolClient: true,
        allowedOAuthFlows: ["code"],
        allowedOAuthScopes: ["openid", "email", "profile"],
        callbackUrLs: oauthCallbackUrls.valueAsList,
        logoutUrLs: oauthLogoutUrls.valueAsList,
        supportedIdentityProviders: [
          "COGNITO",
          "Google",
          "SignInWithApple",
          "Microsoft",
        ],
        explicitAuthFlows: ["ALLOW_CUSTOM_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      }
    );

    userPoolClient.addDependency(googleProvider);
    userPoolClient.addDependency(appleProvider);
    userPoolClient.addDependency(microsoftProvider);

    // Admin group
    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "admin",
      description: "Administrative users",
    });

    // ---------------------------------------------------------------------
    // Lambda Functions
    // ---------------------------------------------------------------------
    const lambdaFactory = new PythonLambdaFactory(this, {
      vpc,
      securityGroups: [lambdaSecurityGroup],
    });

    // Helper to create Lambda functions using the factory
    // Note: functionName is omitted to let CloudFormation generate unique names
    // and avoid conflicts with existing Lambda functions.
    const createPythonFunction = (
      id: string,
      props: {
        handler: string;
        environment?: Record<string, string>;
        timeout?: cdk.Duration;
        extraCopyCommands?: string[];
        securityGroups?: ec2.ISecurityGroup[];
        memorySize?: number;
      }
    ) => {
      const pythonLambda = lambdaFactory.create(id, {
        handler: props.handler,
        environment: props.environment,
        timeout: props.timeout,
        extraCopyCommands: props.extraCopyCommands,
        securityGroups: props.securityGroups ?? [lambdaSecurityGroup],
        memorySize: props.memorySize,
      });
      return pythonLambda.function;
    };

    // Search function
    const searchFunction = createPythonFunction("SiutindeiSearchFunction", {
      handler: "lambda/activity_search/handler.lambda_handler",
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "siutindei",
        DATABASE_USERNAME: "siutindei_app",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
      },
    });
    database.grantSecretRead(searchFunction);
    database.grantConnect(searchFunction, "siutindei_app");

    // Admin function
    const adminFunction = createPythonFunction("SiutindeiAdminFunction", {
      handler: "lambda/admin/handler.lambda_handler",
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "siutindei",
        DATABASE_USERNAME: "siutindei_admin",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        ADMIN_GROUP: "admin",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
      },
    });
    database.grantSecretRead(adminFunction);
    database.grantConnect(adminFunction, "siutindei_admin");

    adminFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
        ],
        resources: [userPool.userPoolArn],
      })
    );

    // Migration function
    const migrationFunction = createPythonFunction("SiutindeiMigrationFunction", {
      handler: "lambda/migrations/handler.lambda_handler",
      timeout: cdk.Duration.minutes(5),
      securityGroups: [migrationSecurityGroup],
      extraCopyCommands: ["cp -au db /asset-output/db"],
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "siutindei",
        DATABASE_USERNAME: "postgres",
        DATABASE_IAM_AUTH: "false",
        DATABASE_HOST: database.cluster.clusterEndpoint.hostname,
        DATABASE_PORT: database.cluster.clusterEndpoint.port.toString(),
        SEED_FILE_PATH: "/var/task/db/seed/seed_data.sql",
      },
    });
    database.grantSecretRead(migrationFunction);
    database.grantConnect(migrationFunction, "postgres");
    migrationFunction.node.addDependency(database.cluster);

    // Auth Lambda triggers
    const preSignUpFunction = createPythonFunction("AuthPreSignUpFunction", {
      handler: "lambda/auth/pre_signup/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
    });

    const defineAuthChallengeFunction = createPythonFunction(
      "AuthDefineChallengeFunction",
      {
        handler: "lambda/auth/define_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          MAX_CHALLENGE_ATTEMPTS: maxChallengeAttempts.valueAsString,
        },
      }
    );

    const createAuthChallengeFunction = createPythonFunction(
      "AuthCreateChallengeFunction",
      {
        handler: "lambda/auth/create_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          SES_FROM_ADDRESS: authEmailFromAddress.valueAsString,
          LOGIN_LINK_BASE_URL: loginLinkBaseUrl.valueAsString,
        },
      }
    );

    createAuthChallengeFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );

    const verifyAuthChallengeFunction = createPythonFunction(
      "AuthVerifyChallengeFunction",
      {
        handler: "lambda/auth/verify_auth_challenge/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
      }
    );

    // Register Cognito triggers
    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignUpFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
      defineAuthChallengeFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
      createAuthChallengeFunction
    );
    userPool.addTrigger(
      cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
      verifyAuthChallengeFunction
    );

    // Device attestation authorizer
    const deviceAttestationFunction = createPythonFunction(
      "DeviceAttestationAuthorizer",
      {
        handler: "lambda/authorizers/device_attestation/handler.lambda_handler",
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        environment: {
          ATTESTATION_JWKS_URL: deviceAttestationJwksUrl.valueAsString,
          ATTESTATION_ISSUER: deviceAttestationIssuer.valueAsString,
          ATTESTATION_AUDIENCE: deviceAttestationAudience.valueAsString,
          // SECURITY: Fail-closed mode denies requests when attestation is not configured
          ATTESTATION_FAIL_CLOSED: deviceAttestationFailClosed.valueAsString,
        },
      }
    );

    const deviceAttestationAuthorizer = new apigateway.RequestAuthorizer(
      this,
      "DeviceAttestationRequestAuthorizer",
      {
        handler: deviceAttestationFunction,
        identitySources: [
          apigateway.IdentitySource.header("x-device-attestation"),
        ],
        resultsCacheTtl: cdk.Duration.seconds(0),
      }
    );

    // Health check function
    const healthFunction = createPythonFunction("HealthCheckFunction", {
      handler: "lambda/health/handler.lambda_handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        DATABASE_SECRET_ARN: database.secret?.secretArn ?? "",
        DATABASE_NAME: "siutindei",
        DATABASE_PROXY_ENDPOINT: database.proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        DATABASE_USERNAME: "siutindei_app",
        ENVIRONMENT: "production",
        APP_VERSION: "1.0.0",
      },
    });
    database.grantSecretRead(healthFunction);
    database.grantConnect(healthFunction, "siutindei_app");

    // ---------------------------------------------------------------------
    // API Gateway
    // ---------------------------------------------------------------------
    const apiGatewayLogRole = new iam.Role(this, "ApiGatewayLogRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
      ],
    });
    new apigateway.CfnAccount(this, "ApiGatewayAccount", {
      cloudWatchRoleArn: apiGatewayLogRole.roleArn,
    });

    const apiAccessLogGroupName = name("api-access-logs");
    const apiAccessLogRetention = new logs.LogRetention(
      this,
      "ApiAccessLogRetention",
      {
        logGroupName: apiAccessLogGroupName,
        retention: logs.RetentionDays.ONE_WEEK,
      }
    );
    const apiAccessLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "ApiAccessLogs",
      apiAccessLogGroupName
    );

    // SECURITY: Restrict CORS to specific allowed origins
    // Never use Cors.ALL_ORIGINS in production - it allows any website to make requests
    const resolvedCorsOrigins = cdk.Fn.conditionIf(
      "HasCorsOrigins",
      corsAllowedOrigins.valueAsList,
      // Default: Allow only mobile app deep link schemes and localhost for dev
      ["capacitor://localhost", "ionic://localhost", "http://localhost"]
    );

    new cdk.CfnCondition(this, "HasCorsOrigins", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(
          cdk.Fn.select(0, corsAllowedOrigins.valueAsList),
          ""
        )
      ),
    });

    const api = new apigateway.RestApi(this, "SiutindeiApi", {
      restApiName: name("api"),
      defaultCorsPreflightOptions: {
        allowOrigins: resolvedCorsOrigins as unknown as string[],
        allowMethods: ["GET", "OPTIONS"],
      },
      deployOptions: {
        stageName: "prod",
        accessLogDestination: new apigateway.LogGroupLogDestination(
          apiAccessLogGroup
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        cacheClusterEnabled: true,
        cacheClusterSize: "0.5",
        cacheDataEncrypted: true,
        methodOptions: {
          "/v1/activities/search/GET": {
            cachingEnabled: true,
            cacheTtl: cdk.Duration.minutes(5),
          },
        },
      },
    });
    api.deploymentStage.node.addDependency(apiAccessLogRetention);

    new logs.LogRetention(this, "ApiExecutionLogRetention", {
      logGroupName: `API-Gateway-Execution-Logs_${api.restApiId}/${api.deploymentStage.stageName}`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "SiutindeiAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    const mobileApiKey = new apigateway.ApiKey(this, "MobileSearchApiKey", {
      apiKeyName: name("mobile-search-key"),
      value: publicApiKeyValue.valueAsString,
    });
    const mobileUsagePlan = api.addUsagePlan("MobileSearchUsagePlan", {
      name: name("mobile-search-plan"),
    });
    mobileUsagePlan.addApiKey(mobileApiKey);
    mobileUsagePlan.addApiStage({ stage: api.deploymentStage });

    // ---------------------------------------------------------------------
    // API Routes
    // ---------------------------------------------------------------------

    // Health check endpoint (no auth)
    const health = api.root.addResource("health");
    health.addMethod("GET", new apigateway.LambdaIntegration(healthFunction), {
      authorizationType: apigateway.AuthorizationType.NONE,
      apiKeyRequired: false,
    });

    // v1 API
    const v1 = api.root.addResource("v1");
    const activities = v1.addResource("activities");
    const search = activities.addResource("search");

    const cacheKeyParameters = [
      "method.request.querystring.age",
      "method.request.querystring.district",
      "method.request.querystring.pricing_type",
      "method.request.querystring.price_min",
      "method.request.querystring.price_max",
      "method.request.querystring.schedule_type",
      "method.request.querystring.day_of_week_utc",
      "method.request.querystring.day_of_month",
      "method.request.querystring.start_minutes_utc",
      "method.request.querystring.end_minutes_utc",
      "method.request.querystring.start_at_utc",
      "method.request.querystring.end_at_utc",
      "method.request.querystring.language",
      "method.request.querystring.limit",
      "method.request.querystring.cursor",
    ];
    const requestParameters: Record<string, boolean> = {};
    for (const param of cacheKeyParameters) {
      requestParameters[param] = false;
    }

    search.addMethod("GET", new apigateway.LambdaIntegration(searchFunction), {
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      authorizer: deviceAttestationAuthorizer,
      apiKeyRequired: true,
      requestParameters,
    });

    // Admin routes
    const admin = v1.addResource("admin");
    const adminResources = [
      "organizations",
      "locations",
      "activities",
      "pricing",
      "schedules",
    ];
    const adminIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.AWS_PROXY,
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${adminFunction.functionArn}/invocations`,
    });
    adminFunction.addPermission("AdminApiInvokePermission", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: api.arnForExecuteApi(),
    });

    for (const resourceName of adminResources) {
      const resource = admin.addResource(resourceName);
      resource.addMethod("GET", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resource.addMethod("POST", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });

      const resourceById = resource.addResource("{id}");
      resourceById.addMethod("GET", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resourceById.addMethod("PUT", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resourceById.addMethod("DELETE", adminIntegration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
    }

    const users = admin.addResource("users");
    const userByName = users.addResource("{username}");
    const userGroups = userByName.addResource("groups");
    userGroups.addMethod("POST", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });
    userGroups.addMethod("DELETE", adminIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // ---------------------------------------------------------------------
    // Admin Bootstrap (Conditional)
    // ---------------------------------------------------------------------
    const adminBootstrapEmail = new cdk.CfnParameter(
      this,
      "AdminBootstrapEmail",
      {
        type: "String",
        default: "",
        description: "Optional admin email for bootstrap user creation",
      }
    );
    const adminBootstrapPassword = new cdk.CfnParameter(
      this,
      "AdminBootstrapTempPassword",
      {
        type: "String",
        default: "",
        noEcho: true,
        description: "Temporary password for bootstrap admin user",
      }
    );
    const bootstrapCondition = new cdk.CfnCondition(
      this,
      "CreateAdminBootstrap",
      {
        expression: cdk.Fn.conditionAnd(
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(adminBootstrapEmail.valueAsString, "")
          ),
          cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(adminBootstrapPassword.valueAsString, "")
          )
        ),
      }
    );

    const createAdminUser = new customresources.AwsCustomResource(
      this,
      "AdminBootstrapUser",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminCreateUser",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            TemporaryPassword: adminBootstrapPassword.valueAsString,
            MessageAction: "SUPPRESS",
            UserAttributes: [
              { Name: "email", Value: adminBootstrapEmail.valueAsString },
              { Name: "email_verified", Value: "true" },
            ],
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            adminBootstrapEmail.valueAsString
          ),
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminUpdateUserAttributes",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            UserAttributes: [
              { Name: "email", Value: adminBootstrapEmail.valueAsString },
              { Name: "email_verified", Value: "true" },
            ],
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            adminBootstrapEmail.valueAsString
          ),
        },
        policy: customresources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: [
              "cognito-idp:AdminCreateUser",
              "cognito-idp:AdminUpdateUserAttributes",
            ],
            resources: [userPool.userPoolArn],
          }),
        ]),
        installLatestAwsSdk: false,
      }
    );
    const adminUserResource = createAdminUser.node.findChild(
      "Resource"
    ) as cdk.CustomResource;
    const adminUserCfn = adminUserResource.node.defaultChild as cdk.CfnResource;
    adminUserCfn.cfnOptions.condition = bootstrapCondition;

    const setAdminPassword = new customresources.AwsCustomResource(
      this,
      "AdminBootstrapPassword",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminSetUserPassword",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            Password: adminBootstrapPassword.valueAsString,
            Permanent: true,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `admin-password-${adminBootstrapEmail.valueAsString}`
          ),
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminSetUserPassword",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            Password: adminBootstrapPassword.valueAsString,
            Permanent: true,
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `admin-password-${adminBootstrapEmail.valueAsString}`
          ),
        },
        policy: customresources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ["cognito-idp:AdminSetUserPassword"],
            resources: [userPool.userPoolArn],
          }),
        ]),
        installLatestAwsSdk: false,
      }
    );
    const adminPasswordResource = setAdminPassword.node.findChild(
      "Resource"
    ) as cdk.CustomResource;
    const adminPasswordCfn =
      adminPasswordResource.node.defaultChild as cdk.CfnResource;
    adminPasswordCfn.cfnOptions.condition = bootstrapCondition;
    adminPasswordCfn.addDependency(adminUserCfn);

    const addAdminToGroup = new customresources.AwsCustomResource(
      this,
      "AdminBootstrapGroup",
      {
        onCreate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminAddUserToGroup",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            GroupName: "admin",
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `admin-group-${adminBootstrapEmail.valueAsString}`
          ),
        },
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "adminAddUserToGroup",
          parameters: {
            UserPoolId: userPool.userPoolId,
            Username: adminBootstrapEmail.valueAsString,
            GroupName: "admin",
          },
          physicalResourceId: customresources.PhysicalResourceId.of(
            `admin-group-${adminBootstrapEmail.valueAsString}`
          ),
        },
        policy: customresources.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ["cognito-idp:AdminAddUserToGroup"],
            resources: [userPool.userPoolArn],
          }),
        ]),
        installLatestAwsSdk: false,
      }
    );
    const adminGroupResource = addAdminToGroup.node.findChild(
      "Resource"
    ) as cdk.CustomResource;
    const adminGroupCfn =
      adminGroupResource.node.defaultChild as cdk.CfnResource;
    adminGroupCfn.cfnOptions.condition = bootstrapCondition;
    adminGroupCfn.addDependency(adminPasswordCfn);

    // ---------------------------------------------------------------------
    // Database Migrations
    // ---------------------------------------------------------------------
    const migrationsHash = hashDirectory(
      path.join(__dirname, "../../db/alembic/versions")
    );
    const seedHash = hashFile(path.join(__dirname, "../../db/seed/seed_data.sql"));

    const migrationProvider = new customresources.Provider(
      this,
      "MigrationProvider",
      {
        onEventHandler: migrationFunction,
      }
    );

    const migrateResource = new cdk.CustomResource(this, "RunMigrations", {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        MigrationsHash: migrationsHash,
        SeedHash: seedHash,
        RunSeed: true,
      },
    });
    migrateResource.node.addDependency(database.cluster);

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: database.secret?.secretArn ?? "",
    });

    new cdk.CfnOutput(this, "DatabaseProxyEndpoint", {
      value: database.proxy.endpoint,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.ref,
    });
  }
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return "missing";
  }
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function hashDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    return "missing";
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(hashDirectory(fullPath));
    } else {
      files.push(hashFile(fullPath));
    }
  }

  return crypto.createHash("sha256").update(files.sort().join("")).digest("hex");
}
