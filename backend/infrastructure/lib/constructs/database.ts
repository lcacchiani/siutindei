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
 * - Security groups for database and proxy
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
  /** Security group for the database cluster. */
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  /** Security group for the RDS Proxy. */
  public readonly proxySecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;

    // Database security group
    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
      securityGroupName: name("db-sg"),
      description: "Security group for Aurora database cluster",
    });

    // Proxy security group
    this.proxySecurityGroup = new ec2.SecurityGroup(this, "ProxySecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
      securityGroupName: name("proxy-sg"),
      description: "Security group for RDS Proxy",
    });

    // Allow proxy to access database
    this.dbSecurityGroup.addIngressRule(
      this.proxySecurityGroup,
      ec2.Port.tcp(5432),
      "RDS Proxy access to Aurora"
    );

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
      securityGroups: [this.dbSecurityGroup],
    });

    // RDS Proxy for connection pooling and IAM auth
    this.proxy = new rds.DatabaseProxy(this, "Proxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: this.cluster.secret ? [this.cluster.secret] : [],
      vpc: props.vpc,
      securityGroups: [this.proxySecurityGroup],
      requireTLS: true,
      iamAuth: true,
      dbProxyName: name("db-proxy"),
    });
  }

  /**
   * Allow a security group to access the RDS Proxy.
   */
  public allowFrom(securityGroup: ec2.ISecurityGroup, description: string): void {
    this.proxySecurityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(5432),
      description
    );
  }

  /**
   * Allow direct database access (for migrations).
   */
  public allowDirectAccessFrom(
    securityGroup: ec2.ISecurityGroup,
    description: string
  ): void {
    this.dbSecurityGroup.addIngressRule(
      securityGroup,
      ec2.Port.tcp(5432),
      description
    );
  }

  /**
   * Grant a Lambda function permission to connect via RDS Proxy.
   */
  public grantConnect(fn: cdk.aws_lambda.IFunction, dbUser: string): void {
    this.proxy.grantConnect(fn, dbUser);
  }

  /**
   * Grant a Lambda function permission to read the database secret.
   */
  public grantSecretRead(fn: cdk.aws_lambda.IFunction): void {
    if (this.cluster.secret) {
      this.cluster.secret.grantRead(fn);
    }
  }
}
