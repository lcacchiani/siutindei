import * as childProcess from "child_process";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
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
  /** Reserved concurrency limit. */
  reservedConcurrentExecutions?: number;
  /** KMS key to encrypt environment variables. */
  environmentEncryptionKey?: kms.IKey;
  /** Dead letter queue for failed invocations. */
  deadLetterQueue?: sqs.IQueue;
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

    const sourceRoot = path.join(__dirname, "../../../");
    const cleanupCommands = [
      "find /asset-output -type d -name __pycache__ -prune -exec rm -rf {} +",
      'find /asset-output -type f -name "*.pyc" -delete',
      'find /asset-output -type f -name "*.pyo" -delete',
    ];
    const copyCommands = [
      "PYTHONDONTWRITEBYTECODE=1 python -m pip install --upgrade " +
        "pip==25.3 --no-warn-script-location",
      "PYTHONDONTWRITEBYTECODE=1 python -m pip install -r requirements.txt " +
        "-t /asset-output --no-compile",
      "cp -au lambda /asset-output/lambda",
      "cp -au src /asset-output/src",
      ...(props.extraCopyCommands ?? []),
      ...cleanupCommands,
    ];

    function runLocalCommand(
      command: string,
      args: string[],
      cwd: string,
      env: NodeJS.ProcessEnv
    ): void {
      // nosemgrep
      // Bundling uses trusted local commands with fixed arguments.
      const result = childProcess.spawnSync(command, args, {
        cwd,
        env,
        stdio: "inherit",
      });
      if (result.status !== 0) {
        throw new Error(`Command failed: ${command}`);
      }
    }

    function resolvePythonCommand(): string | null {
      const candidates = ["python3", "python"];
      for (const candidate of candidates) {
        // nosemgrep
        // Checking local python versions is build-time only.
        const versionResult = childProcess.spawnSync(
          candidate,
          [
            "-c",
            "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
          ],
          {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
          }
        );
        if (versionResult.status !== 0) {
          continue;
        }
        const version = versionResult.stdout.trim();
        if (version !== "3.12") {
          continue;
        }
        const result = childProcess.spawnSync(candidate, ["-V"], {
          stdio: "ignore",
        });
        if (result.status === 0) {
          return candidate;
        }
      }
      return null;
    }

    function tryLocalBundle(outputDir: string): boolean {
      const pythonCommand = resolvePythonCommand();
      if (!pythonCommand) {
        return false;
      }
      const env = {
        ...process.env,
        HOME: "/tmp",
        PIP_CACHE_DIR: "/tmp/pip-cache",
        PYTHONUSERBASE: "/tmp/.local",
        PYTHONDONTWRITEBYTECODE: "1",
        PYTHONHASHSEED: "0",
      };
      try {
        runLocalCommand(
          pythonCommand,
          [
            "-m",
            "pip",
            "install",
            "--upgrade",
            "pip==25.3",
            "--no-warn-script-location",
          ],
          sourceRoot,
          env
        );
        runLocalCommand(
          pythonCommand,
          [
            "-m",
            "pip",
            "install",
            "-r",
            "requirements.txt",
            "-t",
            outputDir,
            "--no-compile",
          ],
          sourceRoot,
          env
        );
        runLocalCommand(
          "cp",
          ["-au", "lambda", path.join(outputDir, "lambda")],
          sourceRoot,
          env
        );
        runLocalCommand(
          "cp",
          ["-au", "src", path.join(outputDir, "src")],
          sourceRoot,
          env
        );
        for (const command of props.extraCopyCommands ?? []) {
          const localCommand = command
            .split("/asset-output")
            .join(outputDir);
          runLocalCommand(
            "bash",
            ["-c", localCommand],
            sourceRoot,
            env
          );
        }
        for (const command of cleanupCommands) {
          const localCommand = command.split("/asset-output").join(outputDir);
          runLocalCommand(
            "bash",
            ["-c", localCommand],
            sourceRoot,
            env
          );
        }
        return true;
      } catch {
        return false;
      }
    }

    const environmentEncryptionKey =
      props.environmentEncryptionKey ??
      new kms.Key(this, "EnvironmentEncryptionKey", {
        enableKeyRotation: true,
      });

    const deadLetterQueue =
      props.deadLetterQueue ??
      new sqs.Queue(this, "DeadLetterQueue", {
        encryption: sqs.QueueEncryption.KMS_MANAGED,
        retentionPeriod: cdk.Duration.days(14),
      });

    this.function = new lambda.Function(this, "Function", {
      functionName: props.functionName,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: props.handler,
      description: props.description,
      code:
        props.code ??
        lambda.Code.fromAsset(path.join(__dirname, "../../../"), {
          bundling: {
            image: lambda.Runtime.PYTHON_3_12.bundlingImage,
            command: ["bash", "-c", copyCommands.join(" && ")],
            environment: {
              HOME: "/tmp",
              PIP_CACHE_DIR: "/tmp/pip-cache",
              PYTHONUSERBASE: "/tmp/.local",
              PYTHONDONTWRITEBYTECODE: "1",
              PYTHONHASHSEED: "0",
            },
            local: {
              tryBundle(outputDir: string) {
                return tryLocalBundle(outputDir);
              },
            },
          },
        }),
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      vpc: props.vpc,
      securityGroups: props.securityGroups,
      vpcSubnets: props.vpc
        ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
        : undefined,
      environmentEncryption: environmentEncryptionKey,
      deadLetterQueue,
      deadLetterQueueEnabled: true,
      reservedConcurrentExecutions:
        props.reservedConcurrentExecutions ?? 25,
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
