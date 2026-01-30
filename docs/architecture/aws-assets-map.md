# AWS Assets Map - Backend Deploy

This document maps all AWS resources created by the `backend-deploy` workflow (`.github/workflows/deploy-backend.yml`).

**Stack Name:** `lxsoftware-siutindei`  
**CDK App:** `backend/infrastructure/bin/app.ts`  
**Stack Definition:** `backend/infrastructure/lib/api-stack.ts`

---

## CDK Bootstrap Stack (CDKToolkit)

Created once per account/region when `cdk bootstrap` runs. Not part of the main stack but required for deployment.

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| S3 Bucket | `StagingBucket` | `cdk-*-assets-{account}-{region}` | Stores CDK assets (Lambda bundles, etc.) |
| ECR Repository | `StagingRepository` | `cdk-*-container-assets-{account}-{region}` | For container-based assets (unused in this stack) |
| KMS Key | `StagingKey` | Auto-generated | Encrypts assets in S3/ECR |
| IAM Role | `DeployActionRole` | Auto-generated | Role for CDK deployments |
| IAM Role | `FilePublishingRole` | Auto-generated | Role for publishing to S3 |
| IAM Role | `ImagePublishingRole` | Auto-generated | Role for publishing to ECR |
| IAM Role | `LookupRole` | Auto-generated | Role for cross-account lookups |
| SSM Parameter | `/cdk-bootstrap/{qualifier}/version` | `/cdk-bootstrap/*/version` | Tracks bootstrap version |

---

## Network Infrastructure

### VPC and Subnets

**Created only if `EXISTING_VPC_ID` is not provided.**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| VPC | `SiutindeiVpc` | `lxsoftware-siutindei-vpc` | 2 AZs, CIDR auto-assigned |
| Internet Gateway | `SiutindeiVpcIGW*` | Auto-generated | Attached to VPC |
| Public Subnet | `SiutindeiVpcPublicSubnet*` | Auto-generated | 2 subnets (1 per AZ) |
| Private Subnet | `SiutindeiVpcPrivateSubnet*` | Auto-generated | 2 subnets (1 per AZ) |
| NAT Gateway | `SiutindeiVpcNATGateway*` | Auto-generated | 1 NAT gateway (shared across AZs) |
| Elastic IP | `SiutindeiVpcNATGatewayEIP*` | Auto-generated | For NAT gateway |
| Route Table | `SiutindeiVpcPublicSubnet*RouteTable*` | Auto-generated | Public route table |
| Route Table | `SiutindeiVpcPrivateSubnet*RouteTable*` | Auto-generated | Private route table |
| Route | `SiutindeiVpcPublicSubnet*DefaultRoute*` | Auto-generated | 0.0.0.0/0 → IGW |
| Route | `SiutindeiVpcPrivateSubnet*DefaultRoute*` | Auto-generated | 0.0.0.0/0 → NAT |
| VPC Gateway Attachment | `SiutindeiVpcVPCGW*` | Auto-generated | IGW attachment |

---

## Security Groups

**Created only if corresponding `EXISTING_*_SECURITY_GROUP_ID` is not provided.**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| Security Group | `LambdaSecurityGroup` | `lxsoftware-siutindei-lambda-sg` | For Lambda functions (RETAIN policy) |
| Security Group | `MigrationSecurityGroup` | `lxsoftware-siutindei-migration-sg` | For migration Lambda (RETAIN policy) |
| Security Group | `DatabaseSecurityGroup` | `lxsoftware-siutindei-db-sg` | For Aurora cluster |
| Security Group | `ProxySecurityGroup` | `lxsoftware-siutindei-proxy-sg` | For RDS Proxy |

**Security Group Rules (managed automatically unless existing SGs are used):**

| Source SG | Target SG | Port | Description |
|-----------|-----------|------|-------------|
| `ProxySecurityGroup` | `DatabaseSecurityGroup` | 5432 | RDS Proxy → Aurora |
| `LambdaSecurityGroup` | `ProxySecurityGroup` | 5432 | Lambda → RDS Proxy |
| `MigrationSecurityGroup` | `DatabaseSecurityGroup` | 5432 | Migration Lambda → Aurora (direct) |

---

## Database Infrastructure

### Secrets Manager

**Created only if `EXISTING_DB_CREDENTIALS_SECRET_NAME` and `EXISTING_DB_CREDENTIALS_SECRET_ARN` are not provided.**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| Secret | `DBCredentialsSecret` | `lxsoftware-siutindei-database-credentials` | Auto-generates password for `postgres` user |

### KMS

**Created only if a new secret is created (not using existing).**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| KMS Key | `DatabaseSecretKey` | Auto-generated | Encrypts database secret (rotation enabled) |
| KMS Alias | `DatabaseSecretKeyAlias*` | Auto-generated | Alias for the key |

### RDS Aurora PostgreSQL Serverless v2

**Created only if `EXISTING_DB_CLUSTER_IDENTIFIER` is not provided.**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| DB Subnet Group | `ClusterSubnets*` | Auto-generated | Private subnets for DB |
| DB Cluster | `Cluster*` | `lxsoftware-siutindei-db-cluster` | Aurora Serverless v2, PostgreSQL 16.4 |
| DB Instance | `Cluster*Instance*` | `lxsoftware-siutindei-db-writer` | Writer instance (serverless v2) |
| IAM Role | `DatabaseMonitoringRole` | Auto-generated | Enhanced monitoring role |
| DB Parameter Group | `ClusterParameterGroup*` | Auto-generated | PostgreSQL parameters |
| DB Cluster Parameter Group | `ClusterParameterGroup*` | Auto-generated | Cluster-level parameters |

**Cluster Configuration:**
- Engine: Aurora PostgreSQL 16.4
- Min Capacity: 0.5 ACU
- Max Capacity: 2 ACU
- Database Name: `siutindei`
- IAM Authentication: Enabled (if `applyImmutableSettings=true`)
- Storage Encryption: Enabled (if `applyImmutableSettings=true`)
- CloudWatch Logs: `postgresql` export enabled
- Monitoring: Enhanced monitoring (60s interval)

### RDS Proxy

**Created only if `EXISTING_DB_PROXY_NAME` is not provided.**

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| DB Proxy | `Proxy*` | `lxsoftware-siutindei-db-proxy` | IAM auth enabled, TLS required |
| DB Proxy Target Group | `ProxyTargetGroup*` | Auto-generated | Targets Aurora cluster |
| DB Proxy Target | `ProxyTarget*` | Auto-generated | Links proxy to cluster |

---

## Cognito Authentication

### User Pool

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| User Pool | `SiutindeiUserPool` | `lxsoftware-siutindei-user-pool` | Email sign-in, auto-verify enabled |
| User Pool Domain | `SiutindeiUserPoolDomain` | `{CognitoDomainPrefix}.auth.{region}.amazoncognito.com` | Domain prefix from parameter |
| User Pool Client | `SiutindeiUserPoolClient` | Auto-generated | OAuth client (no secret) |
| User Pool Group | `AdminGroup` | `admin` | Admin group |

### Identity Providers

| Resource Type | Logical ID | Provider Name | Notes |
|--------------|------------|---------------|-------|
| User Pool Identity Provider | `GoogleIdentityProvider` | `Google` | Google OAuth |
| User Pool Identity Provider | `AppleIdentityProvider` | `SignInWithApple` | Apple Sign In |
| User Pool Identity Provider | `MicrosoftIdentityProvider` | `Microsoft` | Microsoft OIDC |

**User Pool Client Configuration:**
- OAuth Flows: `code`
- OAuth Scopes: `openid`, `email`, `profile`
- Supported Providers: `COGNITO`, `Google`, `SignInWithApple`, `Microsoft`
- Explicit Auth Flows: `ALLOW_CUSTOM_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`

---

## Lambda Functions

Each Lambda function created by `PythonLambda` construct includes:
- Lambda function
- IAM execution role
- KMS key for environment variable encryption
- SQS dead-letter queue

### Application Functions

| Function Logical ID | Handler | Memory | Timeout | VPC | Extra Paths |
|---------------------|---------|--------|---------|-----|-------------|
| `SiutindeiSearchFunction` | `lambda/activity_search/handler.lambda_handler` | 512 MB | 30s | Yes | - |
| `SiutindeiAdminFunction` | `lambda/admin/handler.lambda_handler` | 512 MB | 30s | Yes | - |
| `SiutindeiMigrationFunction` | `lambda/migrations/handler.lambda_handler` | 512 MB | 5 min | Yes | `db` |
| `HealthCheckFunction` | `lambda/health/handler.lambda_handler` | 256 MB | 10s | Yes | - |

### Auth Functions

| Function Logical ID | Handler | Memory | Timeout | VPC | Notes |
|---------------------|---------|--------|---------|-----|-------|
| `AuthPreSignUpFunction` | `lambda/auth/pre_signup/handler.lambda_handler` | 256 MB | 10s | No | Cognito trigger |
| `AuthDefineChallengeFunction` | `lambda/auth/define_auth_challenge/handler.lambda_handler` | 256 MB | 10s | No | Cognito trigger |
| `AuthCreateChallengeFunction` | `lambda/auth/create_auth_challenge/handler.lambda_handler` | 256 MB | 10s | No | Cognito trigger, SES permissions |
| `AuthVerifyChallengeFunction` | `lambda/auth/verify_auth_challenge/handler.lambda_handler` | 256 MB | 10s | No | Cognito trigger |

### Other Functions

| Function Logical ID | Handler | Memory | Timeout | VPC | Notes |
|---------------------|---------|--------|---------|-----|-------|
| `DeviceAttestationAuthorizer` | `lambda/authorizers/device_attestation/handler.lambda_handler` | 256 MB | 5s | No | API Gateway authorizer |
| `AdminBootstrapFunction` | `lambda/admin_bootstrap/handler.lambda_handler` | 256 MB | 30s | No | Custom resource handler |

### Lambda Resources Per Function

For each function above, the following resources are created:

| Resource Type | Logical ID Pattern | Notes |
|--------------|-------------------|-------|
| Lambda Function | `{FunctionLogicalID}Function*` | Python 3.12 runtime |
| IAM Role | `{FunctionLogicalID}FunctionServiceRole*` | Execution role |
| IAM Policy | `{FunctionLogicalID}FunctionServiceRoleDefaultPolicy*` | Basic Lambda permissions |
| KMS Key | `{FunctionLogicalID}EnvironmentEncryptionKey*` | Encrypts environment variables (rotation enabled) |
| KMS Alias | `{FunctionLogicalID}EnvironmentEncryptionKeyAlias*` | Alias for the key |
| SQS Queue | `{FunctionLogicalID}DeadLetterQueue*` | DLQ for failed invocations (14-day retention) |
| SQS Queue Policy | `{FunctionLogicalID}DeadLetterQueuePolicy*` | Allows Lambda to send to DLQ |

**Lambda Configuration:**
- Runtime: Python 3.12
- Reserved Concurrency: 25 (default)
- Environment: `PYTHONPATH=/var/task/src`, `LOG_LEVEL=INFO`
- VPC Subnets: Private with egress (if VPC enabled)
- Dead Letter Queue: Enabled

**Additional IAM Permissions:**

| Function | Additional Permissions |
|----------|------------------------|
| `SiutindeiSearchFunction` | Read DB secret, connect to RDS Proxy as `siutindei_app` |
| `SiutindeiAdminFunction` | Read DB secret, connect to RDS Proxy as `siutindei_admin`, Cognito admin group management |
| `SiutindeiMigrationFunction` | Read DB secret, direct connect to Aurora as `postgres`, CloudFormation invoke permission |
| `HealthCheckFunction` | Read DB secret, connect to RDS Proxy as `siutindei_app` |
| `AuthCreateChallengeFunction` | SES `SendEmail`, `SendRawEmail` for the configured email address |
| `AdminBootstrapFunction` | Cognito `AdminCreateUser`, `AdminUpdateUserAttributes`, `AdminSetUserPassword`, `AdminAddUserToGroup`, CloudFormation invoke permission |

**Lambda Log Groups:**
- Created automatically by Lambda service on first invocation
- Naming: `/aws/lambda/{function-name}`
- Not explicitly created by CDK

---

## API Gateway

### REST API

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| REST API | `SiutindeiApi` | `lxsoftware-siutindei-api` | Regional REST API |
| Deployment | `SiutindeiApiDeployment*` | Auto-generated | Deployment for `prod` stage |
| Stage | `SiutindeiApiDeploymentStageprod*` | `prod` | Production stage |

**Stage Configuration:**
- Access Logging: Enabled (to `lxsoftware-siutindei-api-access-logs` - must exist)
- Access Log Format: JSON with standard fields
- Logging Level: INFO
- Data Trace: Disabled
- X-Ray Tracing: Enabled
- Caching: Enabled (0.5 GB cache cluster, encrypted)
- Cache TTL: 5 minutes for `/v1/activities/search/GET`

**CORS Configuration:**
- Allowed Origins: From `CORS_ALLOWED_ORIGINS` env var or context, defaults to `capacitor://localhost`, `ionic://localhost`, `http://localhost`
- Allowed Methods: `GET`, `OPTIONS`

### API Gateway Resources and Methods

| Resource Path | Method | Authorization | Integration | Notes |
|--------------|--------|---------------|-------------|-------|
| `/health` | GET | IAM | `HealthCheckFunction` | Health check endpoint |
| `/v1/activities/search` | GET | Custom (Device Attestation) + API Key | `SiutindeiSearchFunction` | Cached, query params in cache key |
| `/v1/admin/organizations` | GET, POST | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/organizations/{id}` | GET, PUT, DELETE | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/locations` | GET, POST | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/locations/{id}` | GET, PUT, DELETE | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/activities` | GET, POST | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/activities/{id}` | GET, PUT, DELETE | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/pricing` | GET, POST | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/pricing/{id}` | GET, PUT, DELETE | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/schedules` | GET, POST | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/schedules/{id}` | GET, PUT, DELETE | Cognito | `SiutindeiAdminFunction` | Admin CRUD |
| `/v1/admin/users/{username}/groups` | POST, DELETE | Cognito | `SiutindeiAdminFunction` | User group management |

### API Gateway Authorizers

| Resource Type | Logical ID | Type | Handler | Notes |
|--------------|------------|------|---------|-------|
| Request Authorizer | `DeviceAttestationRequestAuthorizer` | Lambda | `DeviceAttestationAuthorizer` | Validates `x-device-attestation` header, no caching |
| Cognito Authorizer | `SiutindeiAuthorizer` | Cognito User Pool | `SiutindeiUserPool` | For admin endpoints |

### API Gateway API Key and Usage Plan

| Resource Type | Logical ID | Physical Name/ID | Notes |
|--------------|------------|------------------|-------|
| API Key | `MobileSearchApiKey` | `lxsoftware-siutindei-mobile-search-key` | Value from `PublicApiKeyValue` parameter |
| Usage Plan | `MobileSearchUsagePlan` | `lxsoftware-siutindei-mobile-search-plan` | Linked to API key and `prod` stage |

### API Gateway IAM Roles

| Resource Type | Logical ID | Purpose | Notes |
|--------------|------------|---------|-------|
| IAM Role | `ApiGatewayLogRole` | CloudWatch Logs | Allows API Gateway to write access logs |

### API Gateway Account Settings

| Resource Type | Logical ID | Notes |
|--------------|------------|-------|
| Account | `ApiGatewayAccount` | Configures CloudWatch role for API Gateway |

**Note:** The access log group `lxsoftware-siutindei-api-access-logs` is **imported** (not created by CDK). It must exist before deployment.

---

## Custom Resources

### Database Migrations

| Resource Type | Logical ID | Handler | Notes |
|--------------|------------|---------|-------|
| Custom Resource | `RunMigrations` | `SiutindeiMigrationFunction` | Runs Alembic migrations on stack create/update (triggered by migration hash change) |

**Properties:**
- `MigrationsHash`: SHA256 hash of `backend/db/alembic/versions/` directory
- `SeedHash`: SHA256 hash of `backend/db/seed/seed_data.sql`
- `RunSeed`: `true`

### Admin Bootstrap

**Created only if `AdminBootstrapEmail` and `AdminBootstrapTempPassword` parameters are provided.**

| Resource Type | Logical ID | Handler | Notes |
|--------------|------------|---------|-------|
| Custom Resource | `AdminBootstrapResource` | `AdminBootstrapFunction` | Creates admin user in Cognito |

**Properties:**
- `UserPoolId`: Cognito User Pool ID
- `Email`: Admin email address
- `TempPassword`: Temporary password
- `GroupName`: `admin`

---

## CloudFormation Parameters

| Parameter Name | Type | Required | NoEcho | Description |
|----------------|------|----------|---------|-------------|
| `CognitoDomainPrefix` | String | Yes | No | Hosted UI domain prefix |
| `CognitoCallbackUrls` | CommaDelimitedList | Yes | No | OAuth callback URLs |
| `CognitoLogoutUrls` | CommaDelimitedList | Yes | No | OAuth logout URLs |
| `GoogleClientId` | String | Yes | No | Google OAuth client ID |
| `GoogleClientSecret` | String | Yes | Yes | Google OAuth client secret |
| `AppleClientId` | String | Yes | No | Apple Services ID |
| `AppleTeamId` | String | Yes | No | Apple developer team ID |
| `AppleKeyId` | String | Yes | No | Apple Sign In key ID |
| `ApplePrivateKey` | String | Yes | Yes | Apple Sign In private key |
| `MicrosoftTenantId` | String | Yes | No | Microsoft Entra tenant ID |
| `MicrosoftClientId` | String | Yes | No | Microsoft OAuth client ID |
| `MicrosoftClientSecret` | String | Yes | Yes | Microsoft OAuth client secret |
| `AuthEmailFromAddress` | String | Yes | No | SES-verified email for passwordless auth |
| `LoginLinkBaseUrl` | String | No | No | Base URL for magic links (default: empty) |
| `MaxChallengeAttempts` | Number | No | No | Max passwordless auth attempts (default: 3) |
| `PublicApiKeyValue` | String | Yes | Yes | API key for mobile search (min 20 chars) |
| `DeviceAttestationJwksUrl` | String | No | No | JWKS URL for device attestation (default: empty) |
| `DeviceAttestationIssuer` | String | No | No | Expected issuer (default: empty) |
| `DeviceAttestationAudience` | String | No | No | Expected audience (default: empty) |
| `DeviceAttestationFailClosed` | String | No | No | Fail-closed mode (default: `true`, allowed: `true`/`false`) |
| `AdminBootstrapEmail` | String | No | No | Admin email for bootstrap (default: empty) |
| `AdminBootstrapTempPassword` | String | No | Yes | Temporary password for bootstrap (default: empty) |

---

## CloudFormation Outputs

| Output Name | Value | Description |
|-------------|-------|-------------|
| `ApiUrl` | API Gateway REST API URL | Base URL for API endpoints |
| `DatabaseSecretArn` | Secrets Manager secret ARN | ARN of database credentials secret |
| `DatabaseProxyEndpoint` | RDS Proxy endpoint | Endpoint for database connections via proxy |
| `UserPoolId` | Cognito User Pool ID | User Pool identifier |
| `UserPoolClientId` | Cognito User Pool Client ID | OAuth client identifier |

---

## Resource Dependencies

### Key Dependencies

1. **VPC** → Security Groups → Database/Lambda
2. **Database Secret** → Aurora Cluster → RDS Proxy
3. **Aurora Cluster** → Migration Lambda (direct access)
4. **RDS Proxy** → Application Lambdas (via proxy)
5. **Cognito User Pool** → Identity Providers → User Pool Client
6. **Cognito User Pool** → Auth Lambda Triggers
7. **Lambda Functions** → API Gateway Integrations
8. **API Gateway** → Usage Plan → API Key
9. **Migration Lambda** → Custom Resource (RunMigrations)
10. **Admin Bootstrap Lambda** → Custom Resource (AdminBootstrapResource)

### Conditional Resources

- **VPC**: Created if `EXISTING_VPC_ID` is not set
- **Security Groups**: Created if corresponding `EXISTING_*_SECURITY_GROUP_ID` is not set
- **Database Secret**: Created if `EXISTING_DB_CREDENTIALS_SECRET_NAME` and `EXISTING_DB_CREDENTIALS_SECRET_ARN` are not set
- **Aurora Cluster**: Created if `EXISTING_DB_CLUSTER_IDENTIFIER` is not set
- **RDS Proxy**: Created if `EXISTING_DB_PROXY_NAME` is not set
- **Admin Bootstrap**: Created if `AdminBootstrapEmail` and `AdminBootstrapTempPassword` are provided

---

## Resource Naming Convention

All resources use the prefix: **`lxsoftware-siutindei-`**

Examples:
- VPC: `lxsoftware-siutindei-vpc`
- Security Group: `lxsoftware-siutindei-lambda-sg`
- Database Cluster: `lxsoftware-siutindei-db-cluster`
- User Pool: `lxsoftware-siutindei-user-pool`
- API: `lxsoftware-siutindei-api`

---

## Tagging Coverage

The stack applies two tags at the stack level:

- `Organization= LX Software`
- `Project= Siu Tin Dei`

These tags are inherited by **all taggable resources** created in this
stack, including implicit resources created by CDK (subnets, route
tables, etc.).

Tags are **not guaranteed** on the following:

- Resource types that do not support tagging.
- Imported or existing resources (for example, an existing VPC, DB
  cluster, security groups, or the API access log group).
- Resources created outside the stack lifecycle, such as Lambda log
  groups created on first invocation.
- CDK bootstrap stack resources (CDKToolkit), which are separate from
  this stack.

---

## Logical IDs (Synthesized, no wildcards)

These logical IDs were generated from a local CDK synth using:

- `CDK_DEFAULT_ACCOUNT=111111111111`
- `CDK_DEFAULT_REGION=us-east-1`
- `availability-zones` context set to `us-east-1a, us-east-1b`

Logical IDs are stable across accounts and regions. If the deployment
imports existing resources (via `EXISTING_*` environment variables),
those resources will not be synthesized and will be absent from this
list.

Total resources: 190

| Logical ID | Type |
|---|---|
| `AdminBootstrapFunction6FD9ACC5` | `AWS::Lambda::Function` |
| `AdminBootstrapFunctionAdminBootstrapInvokePermission3CCA48B1` | `AWS::Lambda::Permission` |
| `AdminBootstrapFunctionDeadLetterQueueF416BA67` | `AWS::SQS::Queue` |
| `AdminBootstrapFunctionEnvironmentEncryptionKey485BAC53` | `AWS::KMS::Key` |
| `AdminBootstrapFunctionServiceRoleA653140D` | `AWS::IAM::Role` |
| `AdminBootstrapFunctionServiceRoleDefaultPolicy8272E7DD` | `AWS::IAM::Policy` |
| `AdminBootstrapResource` | `AWS::CloudFormation::CustomResource` |
| `AdminGroup` | `AWS::Cognito::UserPoolGroup` |
| `ApiGatewayAccount` | `AWS::ApiGateway::Account` |
| `ApiGatewayLogRole03004FC3` | `AWS::IAM::Role` |
| `AppleIdentityProvider` | `AWS::Cognito::UserPoolIdentityProvider` |
| `AuthCreateChallengeFunctionDeadLetterQueueFC99F5A3` | `AWS::SQS::Queue` |
| `AuthCreateChallengeFunctionEnvironmentEncryptionKeyAE829E94` | `AWS::KMS::Key` |
| `AuthCreateChallengeFunctionF47DBD80` | `AWS::Lambda::Function` |
| `AuthCreateChallengeFunctionServiceRole8CFAA20D` | `AWS::IAM::Role` |
| `AuthCreateChallengeFunctionServiceRoleDefaultPolicy33837AEA` | `AWS::IAM::Policy` |
| `AuthDefineChallengeFunction0FEC94DF` | `AWS::Lambda::Function` |
| `AuthDefineChallengeFunctionDeadLetterQueueAD5FC46C` | `AWS::SQS::Queue` |
| `AuthDefineChallengeFunctionEnvironmentEncryptionKeyA182103D` | `AWS::KMS::Key` |
| `AuthDefineChallengeFunctionServiceRole4CD08888` | `AWS::IAM::Role` |
| `AuthDefineChallengeFunctionServiceRoleDefaultPolicy56450EF0` | `AWS::IAM::Policy` |
| `AuthPreSignUpFunction11D320F7` | `AWS::Lambda::Function` |
| `AuthPreSignUpFunctionDeadLetterQueueB6EBA34F` | `AWS::SQS::Queue` |
| `AuthPreSignUpFunctionEnvironmentEncryptionKey84F25466` | `AWS::KMS::Key` |
| `AuthPreSignUpFunctionServiceRoleDE5165E8` | `AWS::IAM::Role` |
| `AuthPreSignUpFunctionServiceRoleDefaultPolicyCEBCF07D` | `AWS::IAM::Policy` |
| `AuthVerifyChallengeFunction6CDF7E35` | `AWS::Lambda::Function` |
| `AuthVerifyChallengeFunctionDeadLetterQueue18040DA1` | `AWS::SQS::Queue` |
| `AuthVerifyChallengeFunctionEnvironmentEncryptionKey237034B2` | `AWS::KMS::Key` |
| `AuthVerifyChallengeFunctionServiceRoleAC3F45B3` | `AWS::IAM::Role` |
| `AuthVerifyChallengeFunctionServiceRoleDefaultPolicyCF86E5CF` | `AWS::IAM::Policy` |
| `CDKMetadata` | `AWS::CDK::Metadata` |
| `DatabaseCluster5B53A178` | `AWS::RDS::DBCluster` |
| `DatabaseClusterSubnets5540150D` | `AWS::RDS::DBSubnetGroup` |
| `DatabaseClusterwriterF225C73E` | `AWS::RDS::DBInstance` |
| `DatabaseDBCredentialsSecretAttachmentE4837AFC` | `AWS::SecretsManager::SecretTargetAttachment` |
| `DatabaseDBCredentialsSecretEAAE2F4B` | `AWS::SecretsManager::Secret` |
| `DatabaseDatabaseMonitoringRoleAD7C676C` | `AWS::IAM::Role` |
| `DatabaseDatabaseSecretKey1F148F58` | `AWS::KMS::Key` |
| `DatabaseDatabaseSecurityGroupDBE5AB2F` | `AWS::EC2::SecurityGroup` |
| `DatabaseDatabaseSecurityGroupfromlxsoftwaresiutindeiDatabaseProxySecurityGroupAF17056A543243E994F8` | `AWS::EC2::SecurityGroupIngress` |
| `DatabaseDatabaseSecurityGroupfromlxsoftwaresiutindeiDatabaseProxySecurityGroupAF17056AIndirectPort8BD050BF` | `AWS::EC2::SecurityGroupIngress` |
| `DatabaseDatabaseSecurityGroupfromlxsoftwaresiutindeiMigrationSecurityGroupDA40BCCD5432F4EEE24D` | `AWS::EC2::SecurityGroupIngress` |
| `DatabaseProxyE01FC4E6` | `AWS::RDS::DBProxy` |
| `DatabaseProxyIAMRoleA7127453` | `AWS::IAM::Role` |
| `DatabaseProxyIAMRoleDefaultPolicy262261D3` | `AWS::IAM::Policy` |
| `DatabaseProxyProxyTargetGroupCFEDF3AA` | `AWS::RDS::DBProxyTargetGroup` |
| `DatabaseProxySecurityGroupCCC9DB86` | `AWS::EC2::SecurityGroup` |
| `DatabaseProxySecurityGroupfromlxsoftwaresiutindeiLambdaSecurityGroupCA6CFF7C5432D30236C0` | `AWS::EC2::SecurityGroupIngress` |
| `DeviceAttestationAuthorizerDeadLetterQueueE1DFBB53` | `AWS::SQS::Queue` |
| `DeviceAttestationAuthorizerEnvironmentEncryptionKeyB6068E86` | `AWS::KMS::Key` |
| `DeviceAttestationAuthorizerFunction21C1AA93` | `AWS::Lambda::Function` |
| `DeviceAttestationAuthorizerFunctionServiceRole45E5577D` | `AWS::IAM::Role` |
| `DeviceAttestationAuthorizerFunctionServiceRoleDefaultPolicy8A22BD20` | `AWS::IAM::Policy` |
| `DeviceAttestationAuthorizerFunctionlxsoftwaresiutindeiDeviceAttestationRequestAuthorizerB8C61717PermissionsB47D3D2B` | `AWS::Lambda::Permission` |
| `DeviceAttestationRequestAuthorizerB8711957` | `AWS::ApiGateway::Authorizer` |
| `GoogleIdentityProvider` | `AWS::Cognito::UserPoolIdentityProvider` |
| `HealthCheckFunctionDeadLetterQueue58B556B4` | `AWS::SQS::Queue` |
| `HealthCheckFunctionEFA68824` | `AWS::Lambda::Function` |
| `HealthCheckFunctionEnvironmentEncryptionKeyEF75276E` | `AWS::KMS::Key` |
| `HealthCheckFunctionServiceRoleABC379C9` | `AWS::IAM::Role` |
| `HealthCheckFunctionServiceRoleDefaultPolicy1BEE44C8` | `AWS::IAM::Policy` |
| `LambdaSecurityGroup0BD9FC99` | `AWS::EC2::SecurityGroup` |
| `MicrosoftIdentityProvider` | `AWS::Cognito::UserPoolIdentityProvider` |
| `MigrationSecurityGroupBCB362A0` | `AWS::EC2::SecurityGroup` |
| `MobileSearchApiKeyA8120D46` | `AWS::ApiGateway::ApiKey` |
| `RunMigrations` | `AWS::CloudFormation::CustomResource` |
| `SiutindeiAdminFunction685E0E6F` | `AWS::Lambda::Function` |
| `SiutindeiAdminFunctionAdminApiInvokePermission2FBD09B0` | `AWS::Lambda::Permission` |
| `SiutindeiAdminFunctionDeadLetterQueueC7203ED8` | `AWS::SQS::Queue` |
| `SiutindeiAdminFunctionEnvironmentEncryptionKeyCB1D7E16` | `AWS::KMS::Key` |
| `SiutindeiAdminFunctionServiceRole3C86388A` | `AWS::IAM::Role` |
| `SiutindeiAdminFunctionServiceRoleDefaultPolicy1C91E99F` | `AWS::IAM::Policy` |
| `SiutindeiApi5C4753F7` | `AWS::ApiGateway::RestApi` |
| `SiutindeiApiAccount92BFC85C` | `AWS::ApiGateway::Account` |
| `SiutindeiApiCloudWatchRole2FD5072B` | `AWS::IAM::Role` |
| `SiutindeiApiDeployment61AE0A80ffb3d0cc7fbcf7f4a45147165eee3eb0` | `AWS::ApiGateway::Deployment` |
| `SiutindeiApiDeploymentStageprodC8434C74` | `AWS::ApiGateway::Stage` |
| `SiutindeiApiMobileSearchUsagePlanC2879D17` | `AWS::ApiGateway::UsagePlan` |
| `SiutindeiApiMobileSearchUsagePlanUsagePlanKeyResourcelxsoftwaresiutindeiMobileSearchApiKeyE03F905C8A6A77A7` | `AWS::ApiGateway::UsagePlanKey` |
| `SiutindeiApiOPTIONS6E05F5EF` | `AWS::ApiGateway::Method` |
| `SiutindeiApihealth1F499F16` | `AWS::ApiGateway::Resource` |
| `SiutindeiApihealthGET1F498D87` | `AWS::ApiGateway::Method` |
| `SiutindeiApihealthGETApiPermissionTestlxsoftwaresiutindeiSiutindeiApiC6FCB485GEThealth52CA776B` | `AWS::Lambda::Permission` |
| `SiutindeiApihealthGETApiPermissionlxsoftwaresiutindeiSiutindeiApiC6FCB485GEThealth18BA22E7` | `AWS::Lambda::Permission` |
| `SiutindeiApihealthOPTIONS9490129D` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1D0FDD2A0` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1OPTIONS844F5FF9` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1activities1447C04E` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1activitiesOPTIONS9C5B72E6` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1activitiessearch2641876C` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1activitiessearchGET8AA7ACBA` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1activitiessearchGETApiPermissionTestlxsoftwaresiutindeiSiutindeiApiC6FCB485GETv1activitiessearchA8DCE272` | `AWS::Lambda::Permission` |
| `SiutindeiApiv1activitiessearchGETApiPermissionlxsoftwaresiutindeiSiutindeiApiC6FCB485GETv1activitiessearch5280D226` | `AWS::Lambda::Permission` |
| `SiutindeiApiv1activitiessearchOPTIONS5F46585C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1admin0B8AEE9A` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminOPTIONSC7664526` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivities20619C1A` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminactivitiesGETF7ED8AA8` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesOPTIONSC1C3175B` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesPOST745042E8` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesid47335C65` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminactivitiesidDELETE8EF914D2` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesidGETFAB535BE` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesidOPTIONS5743F7C4` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminactivitiesidPUT2D5F366D` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocations3D8BC59D` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminlocationsGET98F45D7C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsOPTIONS77B2368C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsPOSTEB237722` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsidB735FE54` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminlocationsidDELETECE70CE84` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsidGET017EEB2E` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsidOPTIONSF0F606D2` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminlocationsidPUT7FC2C2FC` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsC0E561DE` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminorganizationsGET51B39E90` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsOPTIONSC867D6F8` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsPOSTB28EB34E` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsid9433B393` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminorganizationsidDELETE3A3DB26C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsidGET0FE753A3` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsidOPTIONSBA66AC28` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminorganizationsidPUT39F52BFE` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricing1EC8C86B` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminpricingGETBCA45EA2` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingOPTIONSDD896829` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingPOSTFFF2B3FC` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingidB7DD8C67` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminpricingidDELETE5FCFC9D5` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingidGET4B16995C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingidOPTIONS8BA1C02C` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminpricingidPUT2313DAAC` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesDA912B51` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminschedulesGET4A5E7AA0` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesOPTIONSEF29FE54` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesPOSTFB004592` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesidB43122C4` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminschedulesidDELETED1ECF382` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesidGET04AB5A9E` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesidOPTIONS696175D5` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminschedulesidPUT351828D3` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminusersAE8489F8` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminusersOPTIONS8BD1E033` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminusersusernameF025C681` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminusersusernameOPTIONS7704CB48` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminusersusernamegroups03ACFC33` | `AWS::ApiGateway::Resource` |
| `SiutindeiApiv1adminusersusernamegroupsDELETE37B3B304` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminusersusernamegroupsOPTIONS3AF0DBEC` | `AWS::ApiGateway::Method` |
| `SiutindeiApiv1adminusersusernamegroupsPOST89E7E3D0` | `AWS::ApiGateway::Method` |
| `SiutindeiAuthorizer8C92AB58` | `AWS::ApiGateway::Authorizer` |
| `SiutindeiMigrationFunction4FE739F8` | `AWS::Lambda::Function` |
| `SiutindeiMigrationFunctionDeadLetterQueue9D2397AE` | `AWS::SQS::Queue` |
| `SiutindeiMigrationFunctionEnvironmentEncryptionKey920DEEC9` | `AWS::KMS::Key` |
| `SiutindeiMigrationFunctionMigrationInvokePermission1116F160` | `AWS::Lambda::Permission` |
| `SiutindeiMigrationFunctionServiceRoleA9397A65` | `AWS::IAM::Role` |
| `SiutindeiMigrationFunctionServiceRoleDefaultPolicy71FE77B3` | `AWS::IAM::Policy` |
| `SiutindeiSearchFunctionBFAC194B` | `AWS::Lambda::Function` |
| `SiutindeiSearchFunctionDeadLetterQueueF5EBAA88` | `AWS::SQS::Queue` |
| `SiutindeiSearchFunctionEnvironmentEncryptionKey579BE3A8` | `AWS::KMS::Key` |
| `SiutindeiSearchFunctionServiceRoleDefaultPolicy7FD2D07F` | `AWS::IAM::Policy` |
| `SiutindeiSearchFunctionServiceRoleE0324DA8` | `AWS::IAM::Role` |
| `SiutindeiUserPoolA200ECAF` | `AWS::Cognito::UserPool` |
| `SiutindeiUserPoolClient` | `AWS::Cognito::UserPoolClient` |
| `SiutindeiUserPoolCreateAuthChallengeCognitoD6C48AC3` | `AWS::Lambda::Permission` |
| `SiutindeiUserPoolDefineAuthChallengeCognitoB3126941` | `AWS::Lambda::Permission` |
| `SiutindeiUserPoolDomain36DD5649` | `AWS::Cognito::UserPoolDomain` |
| `SiutindeiUserPoolPreSignUpCognito539211A9` | `AWS::Lambda::Permission` |
| `SiutindeiUserPoolVerifyAuthChallengeResponseCognito605BA731` | `AWS::Lambda::Permission` |
| `SiutindeiVpc29599EC1` | `AWS::EC2::VPC` |
| `SiutindeiVpcIGW810F8C30` | `AWS::EC2::InternetGateway` |
| `SiutindeiVpcPrivateSubnet1DefaultRoute5B6CE4F8` | `AWS::EC2::Route` |
| `SiutindeiVpcPrivateSubnet1RouteTable30AF1C9C` | `AWS::EC2::RouteTable` |
| `SiutindeiVpcPrivateSubnet1RouteTableAssociation8461CE0F` | `AWS::EC2::SubnetRouteTableAssociation` |
| `SiutindeiVpcPrivateSubnet1SubnetDA30C339` | `AWS::EC2::Subnet` |
| `SiutindeiVpcPrivateSubnet2DefaultRoute7C4F47B0` | `AWS::EC2::Route` |
| `SiutindeiVpcPrivateSubnet2RouteTable0279C6AF` | `AWS::EC2::RouteTable` |
| `SiutindeiVpcPrivateSubnet2RouteTableAssociationE0955199` | `AWS::EC2::SubnetRouteTableAssociation` |
| `SiutindeiVpcPrivateSubnet2Subnet8D66AF40` | `AWS::EC2::Subnet` |
| `SiutindeiVpcPublicSubnet1DefaultRouteABFF18EE` | `AWS::EC2::Route` |
| `SiutindeiVpcPublicSubnet1EIP78A7046B` | `AWS::EC2::EIP` |
| `SiutindeiVpcPublicSubnet1NATGateway2F2F9903` | `AWS::EC2::NatGateway` |
| `SiutindeiVpcPublicSubnet1RouteTable12A605AA` | `AWS::EC2::RouteTable` |
| `SiutindeiVpcPublicSubnet1RouteTableAssociationE10A8BB9` | `AWS::EC2::SubnetRouteTableAssociation` |
| `SiutindeiVpcPublicSubnet1Subnet9C53F79A` | `AWS::EC2::Subnet` |
| `SiutindeiVpcPublicSubnet2DefaultRoute17004D03` | `AWS::EC2::Route` |
| `SiutindeiVpcPublicSubnet2RouteTable958F45FA` | `AWS::EC2::RouteTable` |
| `SiutindeiVpcPublicSubnet2RouteTableAssociation870F9906` | `AWS::EC2::SubnetRouteTableAssociation` |
| `SiutindeiVpcPublicSubnet2SubnetAC944B12` | `AWS::EC2::Subnet` |
| `SiutindeiVpcVPCGW28B13D3C` | `AWS::EC2::VPCGatewayAttachment` |

---

## Resource Retention Policies

The following resources have **RETAIN** deletion policy (survive stack deletion):

- `LambdaSecurityGroup`
- `MigrationSecurityGroup`

All other resources are deleted when the stack is deleted (unless they are imported/existing resources).

---

## Estimated Resource Count

**Minimum (all existing resources imported):**
- ~50-60 resources (Lambdas, IAM roles, API Gateway resources, etc.)

**Maximum (all resources created):**
- ~150-200 resources (includes VPC, subnets, NAT, Aurora, RDS Proxy, all Lambdas with DLQs/KMS, API Gateway, etc.)

---

## Notes

1. **Lambda Log Groups**: Created automatically by AWS Lambda service on first invocation, not by CDK.
2. **API Gateway Access Log Group**: Must exist before deployment (imported, not created).
3. **Existing Resources**: The workflow detects and imports existing VPC, database, and security group resources to avoid recreation.
4. **CDK Bootstrap**: Required once per account/region. The workflow runs `cdk bootstrap` if needed.
5. **Lambda Bundling**: Lambda code is bundled during `cdk synth` using Docker or local bundle from `.lambda-build/base`.
