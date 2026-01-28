import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/**
 * Properties for the DatabaseConstruct.
 */
export interface DatabaseConstructProps {
  /** Resource name prefix for naming resources. */
  resourcePrefix: string;
  /** VPC to deploy the database into. */
  vpc: ec2.IVpc;
  /** Security group for the database cluster. */
  dbSecurityGroup: ec2.ISecurityGroup;
  /** Security group for the RDS Proxy. */
  proxySecurityGroup: ec2.ISecurityGroup;
  /** Minimum serverless capacity in ACUs. */
  minCapacity?: number;
  /** Maximum serverless capacity in ACUs. */
  maxCapacity?: number;
  /** Default database name. */
  databaseName?: string;
}

/**
 * Construct for Aurora PostgreSQL Serverless v2 database with RDS Proxy.
 *
 * Creates:
 * - Secrets Manager secret for database credentials
 * - Aurora PostgreSQL Serverless v2 cluster
 * - RDS Proxy with IAM authentication
 */
export class DatabaseConstruct extends Construct {
  /** The Aurora database cluster. */
  public readonly cluster: rds.DatabaseCluster;
  /** The RDS Proxy for connection pooling. */
  public readonly proxy: rds.DatabaseProxy;
  /** The database credentials secret. */
  public readonly secret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;

    // Database credentials secret
    const dbCredentialsSecret = new secretsmanager.Secret(
      this,
      "DBCredentialsSecret",
      {
        secretName: name("database-credentials"),
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "postgres" }),
          generateStringKey: "password",
          excludePunctuation: true,
          includeSpace: false,
        },
      }
    );
    this.secret = dbCredentialsSecret;

    // Aurora PostgreSQL Serverless v2 cluster
    this.cluster = new rds.DatabaseCluster(this, "Cluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      cloudwatchLogsExports: ["postgresql"],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_WEEK,
      credentials: rds.Credentials.fromSecret(dbCredentialsSecret),
      defaultDatabaseName: props.databaseName ?? "siutindei",
      iamAuthentication: false,
      serverlessV2MinCapacity: props.minCapacity ?? 0.5,
      serverlessV2MaxCapacity: props.maxCapacity ?? 2,
      writer: rds.ClusterInstance.serverlessV2("writer", {
        instanceIdentifier: name("db-writer"),
      }),
      clusterIdentifier: name("db-cluster"),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.dbSecurityGroup],
    });

    // RDS Proxy for connection pooling and IAM auth
    this.proxy = new rds.DatabaseProxy(this, "Proxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: this.cluster.secret ? [this.cluster.secret] : [],
      vpc: props.vpc,
      securityGroups: [props.proxySecurityGroup],
      requireTLS: true,
      iamAuth: true,
      dbProxyName: name("db-proxy"),
    });
  }
}
