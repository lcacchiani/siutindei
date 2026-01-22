import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as customresources from "aws-cdk-lib/custom-resources";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export class ApiStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "ActivitiesVpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, "LambdaSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    const migrationSecurityGroup = new ec2.SecurityGroup(this, "MigrationSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    const proxySecurityGroup = new ec2.SecurityGroup(this, "ProxySecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    proxySecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      "Lambda access to RDS Proxy"
    );
    dbSecurityGroup.addIngressRule(
      proxySecurityGroup,
      ec2.Port.tcp(5432),
      "RDS Proxy access to Aurora"
    );
    dbSecurityGroup.addIngressRule(
      migrationSecurityGroup,
      ec2.Port.tcp(5432),
      "Migrations access to Aurora"
    );

    const cluster = new rds.DatabaseCluster(this, "ActivitiesCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      defaultDatabaseName: "activities",
      iamAuthentication: true,
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
    });

    const proxy = new rds.DatabaseProxy(this, "ActivitiesProxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(cluster),
      secrets: cluster.secret ? [cluster.secret] : [],
      vpc,
      securityGroups: [proxySecurityGroup],
      requireTLS: true,
      iamAuth: rds.IamAuth.REQUIRED,
    });

    const searchFunction = new lambda.Function(this, "ActivitiesSearchFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "lambda/activity_search/handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "pip install -r requirements.txt -t /asset-output",
              "cp -au lambda /asset-output/lambda",
              "cp -au src /asset-output/src",
            ].join(" && "),
          ],
        },
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc,
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DATABASE_SECRET_ARN: cluster.secret?.secretArn ?? "",
        DATABASE_NAME: "activities",
        DATABASE_USERNAME: "activities_app",
        DATABASE_PROXY_ENDPOINT: proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        PYTHONPATH: "/var/task/src",
      },
    });

    const adminFunction = new lambda.Function(this, "ActivitiesAdminFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "lambda/admin/handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "pip install -r requirements.txt -t /asset-output",
              "cp -au lambda /asset-output/lambda",
              "cp -au src /asset-output/src",
            ].join(" && "),
          ],
        },
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc,
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DATABASE_SECRET_ARN: cluster.secret?.secretArn ?? "",
        DATABASE_NAME: "activities",
        DATABASE_USERNAME: "activities_admin",
        DATABASE_PROXY_ENDPOINT: proxy.endpoint,
        DATABASE_IAM_AUTH: "true",
        ADMIN_GROUP: "admin",
        PYTHONPATH: "/var/task/src",
      },
    });

    const migrationFunction = new lambda.Function(this, "ActivitiesMigrationFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "lambda/migrations/handler.lambda_handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            "bash",
            "-c",
            [
              "pip install -r requirements.txt -t /asset-output",
              "cp -au lambda /asset-output/lambda",
              "cp -au src /asset-output/src",
              "cp -au db /asset-output/db",
            ].join(" && "),
          ],
        },
      }),
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      vpc,
      securityGroups: [migrationSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DATABASE_SECRET_ARN: cluster.secret?.secretArn ?? "",
        DATABASE_NAME: "activities",
        DATABASE_IAM_AUTH: "false",
        PYTHONPATH: "/var/task/src",
        SEED_FILE_PATH: "/var/task/db/seed/seed_data.sql",
      },
    });

    if (cluster.secret) {
      cluster.secret.grantRead(searchFunction);
      cluster.secret.grantRead(migrationFunction);
      cluster.secret.grantRead(adminFunction);
    }

    proxy.grantConnect(searchFunction, "activities_app");
    proxy.grantConnect(adminFunction, "activities_admin");

    const api = new apigateway.RestApi(this, "ActivitiesApi", {
      restApiName: "Activities API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
      },
      deployOptions: {
        stageName: "prod",
        cachingEnabled: true,
        cacheClusterEnabled: true,
        cacheClusterSize: "0.5",
        cacheDataEncrypted: true,
      },
    });

    const userPool = new cognito.UserPool(this, "ActivitiesUserPool", {
      signInAliases: { email: true },
      autoVerify: { email: true },
      selfSignUpEnabled: true,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "ActivitiesUserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "ActivitiesAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

    const activities = api.root.addResource("activities");
    const search = activities.addResource("search");
    const cacheTtl = cdk.Duration.minutes(5);
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
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
      cacheTtl,
      cachingEnabled: true,
      cacheKeyParameters,
      requestParameters,
    });

    const admin = api.root.addResource("admin");
    const adminResources = [
      "organizations",
      "locations",
      "activities",
      "pricing",
      "schedules",
    ];

    for (const resourceName of adminResources) {
      const resource = admin.addResource(resourceName);
      resource.addMethod("GET", new apigateway.LambdaIntegration(adminFunction), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resource.addMethod("POST", new apigateway.LambdaIntegration(adminFunction), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });

      const resourceById = resource.addResource("{id}");
      resourceById.addMethod("GET", new apigateway.LambdaIntegration(adminFunction), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resourceById.addMethod("PUT", new apigateway.LambdaIntegration(adminFunction), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
      resourceById.addMethod("DELETE", new apigateway.LambdaIntegration(adminFunction), {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      });
    }

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: cluster.secret?.secretArn ?? "",
    });

    new cdk.CfnOutput(this, "DatabaseProxyEndpoint", {
      value: proxy.endpoint,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    const migrationsHash = hashDirectory(path.join(__dirname, "../../db/alembic/versions"));
    const seedHash = hashFile(path.join(__dirname, "../../db/seed/seed_data.sql"));

    const migrationProvider = new customresources.Provider(this, "MigrationProvider", {
      onEventHandler: migrationFunction,
    });

    const migrateResource = new cdk.CustomResource(this, "RunMigrations", {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        MigrationsHash: migrationsHash,
        SeedHash: seedHash,
        RunSeed: true,
      },
    });
    migrateResource.node.addDependency(cluster);

    migrationFunction.node.addDependency(cluster);
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
