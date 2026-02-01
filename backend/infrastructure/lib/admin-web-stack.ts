import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

export class AdminWebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "LX Software");
    cdk.Tags.of(this).add("Project", "Siu Tin Dei");

    const resourcePrefix = "lxsoftware-siutindei";
    const name = (suffix: string) => `${resourcePrefix}-${suffix}`;

    const domainName = new cdk.CfnParameter(this, "AdminWebDomainName", {
      type: "String",
      description: "Custom domain for the admin web (CloudFront alias).",
    });

    const certificateArn = new cdk.CfnParameter(
      this,
      "AdminWebCertificateArn",
      {
        type: "String",
        description: "ACM certificate ARN for the admin web domain.",
      }
    );

    // -------------------------------------------------------------------------
    // WAF Web ACL for CloudFront protection
    // SECURITY: WAF must be created in us-east-1 for CloudFront association
    // This stack must be deployed to us-east-1 or use a separate cross-region stack
    // -------------------------------------------------------------------------
    this.webAcl = new wafv2.CfnWebACL(this, "AdminWebWafAcl", {
      defaultAction: { allow: {} },
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name("admin-web-waf"),
        sampledRequestsEnabled: true,
      },
      name: name("admin-web-waf"),
      rules: [
        // AWS Managed Common Rule Set - protects against common web exploits
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
        // Rate limiting - 1000 requests per 5 minutes per IP
        {
          name: "RateLimitRule",
          priority: 3,
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
    // Logging bucket for S3 and CloudFront access logs
    // SECURITY: Access logging required for audit and compliance
    // -------------------------------------------------------------------------
    const loggingBucketName = [
      name("admin-web-logs"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.loggingBucket = new s3.Bucket(this, "AdminWebLoggingBucket", {
      bucketName: loggingBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Lifecycle rule to clean up old logs
      lifecycleRules: [
        {
          id: "ExpireOldLogs",
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
      // Enable object ownership for CloudFront log delivery
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // -------------------------------------------------------------------------
    // Main content bucket with access logging enabled
    // -------------------------------------------------------------------------
    const bucketName = [
      name("admin-web"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    this.bucket = new s3.Bucket(this, "AdminWebBucket", {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // SECURITY: Enable S3 access logging
      serverAccessLogsBucket: this.loggingBucket,
      serverAccessLogsPrefix: "s3-access-logs/",
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "AdminWebOai",
      {
        comment: "OAI for admin web CloudFront distribution.",
      }
    );
    this.bucket.grantRead(originAccessIdentity);

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "AdminWebCertificate",
      certificateArn.valueAsString
    );

    const origin = origins.S3BucketOrigin.withOriginAccessIdentity(
      this.bucket,
      {
        originAccessIdentity,
      }
    );

    // -------------------------------------------------------------------------
    // CloudFront distribution with WAF and access logging
    // -------------------------------------------------------------------------
    this.distribution = new cloudfront.Distribution(
      this,
      "AdminWebDistribution",
      {
        defaultRootObject: "index.html",
        domainNames: [domainName.valueAsString],
        certificate,
        // SECURITY: Associate WAF Web ACL
        webAclId: this.webAcl.attrArn,
        // SECURITY: Enable CloudFront access logging
        enableLogging: true,
        logBucket: this.loggingBucket,
        logFilePrefix: "cloudfront-access-logs/",
        logIncludesCookies: false,
        defaultBehavior: {
          origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.minutes(5),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.minutes(5),
          },
        ],
      }
    );

    new cdk.CfnOutput(this, "AdminWebBucketName", {
      value: this.bucket.bucketName,
    });

    new cdk.CfnOutput(this, "AdminWebDistributionId", {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "AdminWebDistributionDomain", {
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "AdminWebLoggingBucketName", {
      value: this.loggingBucket.bucketName,
      description: "S3 bucket for CloudFront and S3 access logs",
    });

    new cdk.CfnOutput(this, "AdminWebWafAclArn", {
      value: this.webAcl.attrArn,
      description: "WAF Web ACL ARN protecting CloudFront distribution",
    });
  }
}
