import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

/**
 * A Lambda function to monitor for errors and throttles.
 */
export interface MonitoredFunction {
  /** Short identifier used in alarm names (e.g. "search"). */
  label: string;
  /** The Lambda function to monitor. */
  fn: lambda.IFunction;
}

/**
 * Properties for the OpsAlarmsConstruct.
 */
export interface OpsAlarmsConstructProps {
  /** Resource name prefix for naming resources. */
  resourcePrefix: string;
  /**
   * Email address subscribed to the ops alerts topic. May be a CFN
   * parameter token; when empty at deploy time the subscription is skipped.
   */
  alertsEmail: string;
  /** The REST API to monitor for 5XX errors and latency. */
  api: apigateway.RestApi;
  /** Lambda functions to monitor for errors and throttles. */
  monitoredFunctions: MonitoredFunction[];
  /** Aurora cluster identifier to monitor for capacity and connections. */
  dbClusterIdentifier: string;
  /** Existing alarms to route to the ops alerts topic (e.g. DLQ alarm). */
  additionalAlarms?: cloudwatch.Alarm[];
}

const FIVE_MINUTES = cdk.Duration.minutes(5);

/**
 * Construct for launch-readiness operational alarms.
 *
 * Creates a KMS-encrypted SNS topic (optionally subscribed to an email
 * address) and CloudWatch alarms covering the API Gateway, the monitored
 * Lambda functions, and the Aurora cluster. Thresholds are intentionally
 * conservative early-warning values sized for launch traffic; tune them as
 * real traffic patterns emerge.
 */
export class OpsAlarmsConstruct extends Construct {
  /** SNS topic receiving all operational alarms. */
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: OpsAlarmsConstructProps) {
    super(scope, id);

    const name = (suffix: string) => `${props.resourcePrefix}-${suffix}`;

    const topicKey = new kms.Key(this, "OpsAlertsTopicKey", {
      alias: name("kms-ops-alerts"),
      enableKeyRotation: true,
    });
    // CloudWatch alarms must be able to publish to the encrypted topic.
    topicKey.grant(
      new iam.ServicePrincipal("cloudwatch.amazonaws.com"),
      "kms:GenerateDataKey*",
      "kms:Decrypt"
    );

    this.topic = new sns.Topic(this, "OpsAlertsTopic", {
      topicName: name("ops-alerts"),
      masterKey: topicKey,
    });

    const emailSubscription = new sns.CfnSubscription(
      this,
      "OpsAlertsEmailSubscription",
      {
        topicArn: this.topic.topicArn,
        protocol: "email",
        endpoint: props.alertsEmail,
      }
    );
    const hasAlertsEmail = new cdk.CfnCondition(this, "HasOpsAlertsEmail", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(props.alertsEmail, "")
      ),
    });
    emailSubscription.cfnOptions.condition = hasAlertsEmail;

    const alarmAction = new cloudwatchActions.SnsAction(this.topic);
    const alarms: cloudwatch.Alarm[] = [];

    // API Gateway server errors (5XX)
    alarms.push(
      new cloudwatch.Alarm(this, "Api5xxAlarm", {
        alarmName: name("api-5xx-alarm"),
        alarmDescription: "API Gateway returned 5XX responses",
        metric: props.api.metricServerError({
          period: FIVE_MINUTES,
          statistic: "sum",
        }),
        threshold: 5,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    // API Gateway p99 latency
    alarms.push(
      new cloudwatch.Alarm(this, "ApiLatencyP99Alarm", {
        alarmName: name("api-latency-p99-alarm"),
        alarmDescription: "API Gateway p99 latency is elevated",
        metric: props.api.metricLatency({
          period: FIVE_MINUTES,
          statistic: "p99",
        }),
        threshold: 3000,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    // Lambda errors and throttles
    for (const { label, fn } of props.monitoredFunctions) {
      alarms.push(
        new cloudwatch.Alarm(this, `${label}ErrorsAlarm`, {
          alarmName: name(`${label.toLowerCase()}-lambda-errors-alarm`),
          alarmDescription: `${label} Lambda reported invocation errors`,
          metric: fn.metricErrors({
            period: FIVE_MINUTES,
            statistic: "sum",
          }),
          threshold: 3,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        })
      );
      alarms.push(
        new cloudwatch.Alarm(this, `${label}ThrottlesAlarm`, {
          alarmName: name(`${label.toLowerCase()}-lambda-throttles-alarm`),
          alarmDescription: `${label} Lambda invocations were throttled`,
          metric: fn.metricThrottles({
            period: FIVE_MINUTES,
            statistic: "sum",
          }),
          threshold: 1,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        })
      );
    }

    // Aurora Serverless v2 capacity utilization. Sustained 90%+ means the
    // cluster is pinned at max ACU and queries may start queueing.
    alarms.push(
      new cloudwatch.Alarm(this, "AuroraAcuUtilizationAlarm", {
        alarmName: name("aurora-acu-utilization-alarm"),
        alarmDescription:
          "Aurora Serverless v2 capacity is near its configured maximum",
        metric: new cloudwatch.Metric({
          namespace: "AWS/RDS",
          metricName: "ACUUtilization",
          dimensionsMap: { DBClusterIdentifier: props.dbClusterIdentifier },
          period: FIVE_MINUTES,
          statistic: "avg",
        }),
        threshold: 90,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    // Aurora connection count. 2 ACU supports roughly 400 connections; a
    // sustained level near that ceiling indicates pool exhaustion.
    alarms.push(
      new cloudwatch.Alarm(this, "AuroraConnectionsAlarm", {
        alarmName: name("aurora-connections-alarm"),
        alarmDescription: "Aurora database connection count is elevated",
        metric: new cloudwatch.Metric({
          namespace: "AWS/RDS",
          metricName: "DatabaseConnections",
          dimensionsMap: { DBClusterIdentifier: props.dbClusterIdentifier },
          period: FIVE_MINUTES,
          statistic: "avg",
        }),
        threshold: 300,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    );

    for (const alarm of alarms) {
      alarm.addAlarmAction(alarmAction);
    }
    for (const alarm of props.additionalAlarms ?? []) {
      alarm.addAlarmAction(alarmAction);
    }
  }
}
