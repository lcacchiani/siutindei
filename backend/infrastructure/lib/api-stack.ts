import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
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

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc,
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      "Lambda access to Aurora"
    );

    const cluster = new rds.DatabaseCluster(this, "ActivitiesCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      defaultDatabaseName: "activities",
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
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
      securityGroups: [lambdaSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DATABASE_SECRET_ARN: cluster.secret?.secretArn ?? "",
        DATABASE_NAME: "activities",
        PYTHONPATH: "/var/task/src",
        SEED_FILE_PATH: "/var/task/db/seed/seed_data.sql",
      },
    });

    if (cluster.secret) {
      cluster.secret.grantRead(searchFunction);
      cluster.secret.grantRead(migrationFunction);
    }

    const api = new apigateway.RestApi(this, "ActivitiesApi", {
      restApiName: "Activities API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "OPTIONS"],
      },
      deployOptions: {
        stageName: "prod",
      },
    });

    const activities = api.root.addResource("activities");
    const search = activities.addResource("search");
    search.addMethod("GET", new apigateway.LambdaIntegration(searchFunction));

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: cluster.secret?.secretArn ?? "",
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
