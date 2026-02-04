import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { STANDARD_LOG_RETENTION } from "./constructs";

/**
 * WAF Stack for CloudFront protection.
 *
 * IMPORTANT: This stack MUST be deployed to us-east-1 region.
 * WAF WebACLs with CLOUDFRONT scope can only be created in us-east-1.
 *
 * Usage:
 *   cdk deploy WafStack --region us-east-1
 *
 * Then deploy AdminWebStack with the WAF ARN:
 *   cdk deploy AdminWebStack --parameters WafWebAclArn=<output from WafStack>
 */
export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "LX Software");
    cdk.Tags.of(this).add("Project", "Siu Tin Dei");

    const resourcePrefix = "lxsoftware-siutindei";
    const name = (suffix: string) => `${resourcePrefix}-${suffix}`;

    // -------------------------------------------------------------------------
    // WAF Web ACL for CloudFront protection
    // Scope must be CLOUDFRONT and stack must be in us-east-1
    // -------------------------------------------------------------------------
    this.webAcl = new wafv2.CfnWebACL(this, "CloudFrontWafAcl", {
      defaultAction: { allow: {} },
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name("cloudfront-waf"),
        sampledRequestsEnabled: true,
      },
      name: name("cloudfront-waf"),
      description: "WAF WebACL for CloudFront distributions - admin web",
      rules: [
        // AWS Managed Common Rule Set - protects against common web exploits
        // Includes protection against OWASP Top 10 vulnerabilities
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: name("common-rules"),
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Known Bad Inputs Rule Set
        // Blocks requests with known malicious patterns
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: name("known-bad-inputs"),
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Amazon IP Reputation List
        // Blocks requests from IPs known to be malicious
        {
          name: "AWSManagedRulesAmazonIpReputationList",
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: name("ip-reputation"),
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed SQL Injection Rule Set
        // SECURITY: Protects against SQL injection attacks in request bodies,
        // query strings, headers, and cookies
        {
          name: "AWSManagedRulesSQLiRuleSet",
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: name("sqli-rules"),
            sampledRequestsEnabled: true,
          },
        },
        // Rate limiting - 1000 requests per 5 minutes per IP
        // Helps prevent DDoS and brute force attacks
        {
          name: "RateLimitRule",
          priority: 5,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: name("rate-limit"),
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // -------------------------------------------------------------------------
    // WAF Logging to CloudWatch with 90-day retention
    // Log group name must start with "aws-waf-logs-" for WAF logging
    // SECURITY: Encrypted with KMS key (Checkov requirement)
    // -------------------------------------------------------------------------

    // KMS key for WAF log encryption
    const wafLogEncryptionKey = new kms.Key(this, "WafLogEncryptionKey", {
      enableKeyRotation: true,
      description: "KMS key for WAF CloudWatch log encryption",
    });

    // Grant CloudWatch Logs service permission to use the key
    wafLogEncryptionKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*",
        ],
        principals: [
          new iam.ServicePrincipal(
            `logs.${cdk.Stack.of(this).region}.amazonaws.com`
          ),
        ],
        resources: ["*"],
        conditions: {
          ArnLike: {
            "kms:EncryptionContext:aws:logs:arn": `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
          },
        },
      })
    );

    this.logGroup = new logs.LogGroup(this, "WafLogGroup", {
      logGroupName: `aws-waf-logs-${name("cloudfront")}`,
      retention: STANDARD_LOG_RETENTION,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryptionKey: wafLogEncryptionKey,
    });

    new wafv2.CfnLoggingConfiguration(this, "WafLoggingConfig", {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [this.logGroup.logGroupArn],
      // Optionally redact sensitive fields from logs
      redactedFields: [
        {
          singleHeader: { Name: "authorization" },
        },
        {
          singleHeader: { Name: "cookie" },
        },
      ],
    });

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, "WebAclArn", {
      value: this.webAcl.attrArn,
      description: "WAF WebACL ARN for CloudFront association",
      exportName: name("waf-acl-arn"),
    });

    new cdk.CfnOutput(this, "WebAclId", {
      value: this.webAcl.attrId,
      description: "WAF WebACL ID",
    });

    new cdk.CfnOutput(this, "WebAclName", {
      value: this.webAcl.name || name("cloudfront-waf"),
      description: "WAF WebACL Name",
    });

    new cdk.CfnOutput(this, "WafLogGroupName", {
      value: this.logGroup.logGroupName,
      description: "CloudWatch Log Group for WAF logs (90-day retention)",
    });
  }
}
