import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

/**
 * Properties for the PythonLambda construct.
 */
export interface PythonLambdaProps {
  /** Function name (optional - CloudFormation will generate if not provided). */
  functionName?: string;
  /** Handler path (e.g., "lambda/handler.lambda_handler"). */
  handler: string;
  /** Optional function description. */
  description?: string;
  /** Environment variables. */
  environment?: Record<string, string>;
  /** Function timeout. */
  timeout?: cdk.Duration;
  /** Memory size in MB. */
  memorySize?: number;
  /** VPC to deploy into (optional). */
  vpc?: ec2.IVpc;
  /** Security groups (required if vpc is provided). */
  securityGroups?: ec2.ISecurityGroup[];
  /** Additional bundling commands. */
  extraCopyCommands?: string[];
  /** Custom code asset (overrides default bundling). */
  code?: lambda.Code;
  /** Log retention period. */
  logRetention?: logs.RetentionDays;
}

/**
 * Construct for Python Lambda functions with standard configuration.
 *
 * Features:
 * - Automatic bundling with pip install
 * - Log retention configuration
 * - VPC support
 * - Standard PYTHONPATH configuration
 */
export class PythonLambda extends Construct {
  /** The Lambda function. */
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: PythonLambdaProps) {
    super(scope, id);

    const copyCommands = [
      "python -m pip install --upgrade pip==25.3",
      "pip install -r requirements.txt -t /asset-output",
      "cp -au lambda /asset-output/lambda",
      "cp -au src /asset-output/src",
      ...(props.extraCopyCommands ?? []),
    ];

    this.function = new lambda.Function(this, "Function", {
      functionName: props.functionName,
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: props.handler,
      description: props.description,
      code:
        props.code ??
        lambda.Code.fromAsset(path.join(__dirname, "../../../"), {
          bundling: {
            image: lambda.Runtime.PYTHON_3_13.bundlingImage,
            command: ["bash", "-c", copyCommands.join(" && ")],
          },
        }),
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      vpc: props.vpc,
      securityGroups: props.securityGroups,
      vpcSubnets: props.vpc
        ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        : undefined,
      environment: {
        PYTHONPATH: "/var/task/src",
        LOG_LEVEL: "INFO",
        ...props.environment,
      },
    });

    // Configure log retention
    new logs.LogRetention(this, "LogRetention", {
      logGroupName: `/aws/lambda/${this.function.functionName}`,
      retention: props.logRetention ?? logs.RetentionDays.ONE_WEEK,
    });
  }

  /**
   * Grant permissions to connect to RDS Proxy.
   */
  public grantProxyConnect(
    proxy: { grantConnect: (grantee: lambda.IFunction, dbUser: string) => void },
    dbUser: string
  ): void {
    proxy.grantConnect(this.function, dbUser);
  }

  /**
   * Grant read access to a secret.
   */
  public grantSecretRead(
    secret: { grantRead: (grantee: lambda.IFunction) => void }
  ): void {
    secret.grantRead(this.function);
  }
}

/**
 * Factory for creating multiple Lambda functions with shared configuration.
 */
export class PythonLambdaFactory {
  private readonly scope: Construct;
  private readonly defaults: Partial<PythonLambdaProps>;

  constructor(scope: Construct, defaults: Partial<PythonLambdaProps> = {}) {
    this.scope = scope;
    this.defaults = defaults;
  }

  /**
   * Create a new Lambda function with factory defaults.
   */
  public create(id: string, props: PythonLambdaProps): PythonLambda {
    return new PythonLambda(this.scope, id, {
      ...this.defaults,
      ...props,
      environment: {
        ...this.defaults.environment,
        ...props.environment,
      },
    });
  }
}
