import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class AdminWebStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;

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
    // WAF Web ACL ARN (created separately in us-east-1 via WafStack)
    // SECURITY: WAF WebACLs for CloudFront must be in us-east-1
    // Deploy WafStack first: cdk deploy WafStack --region us-east-1
    // IMPORTANT: WAF is required for production deployments (Checkov CKV_AWS_68)
    // -------------------------------------------------------------------------
    const wafWebAclArn = new cdk.CfnParameter(this, "WafWebAclArn", {
      type: "String",
      description:
        "WAF WebACL ARN for CloudFront protection (must be from us-east-1). " +
        "Deploy WafStack to us-east-1 first and use its output. " +
        "SECURITY: This parameter is required for production deployments.",
      allowedPattern: "^arn:aws:wafv2:us-east-1:[0-9]+:global/webacl/.+$",
      constraintDescription:
        "Must be a valid WAF WebACL ARN from us-east-1 " +
        "(e.g., arn:aws:wafv2:us-east-1:123456789012:global/webacl/my-acl/abc123)",
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

    // SECURITY: Versioning enabled to meet Checkov requirements
    // Lifecycle rules configured to manage storage costs for versioned objects
    this.loggingBucket = new s3.Bucket(this, "AdminWebLoggingBucket", {
      bucketName: loggingBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Lifecycle rules to manage storage costs
      lifecycleRules: [
        {
          id: "ExpireOldLogs",
          enabled: true,
          expiration: cdk.Duration.days(90),
          // Clean up non-current versions after 30 days
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      // Enable object ownership for CloudFront log delivery
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    // Checkov suppression: Logging bucket cannot have self-logging (infinite loop)
    const loggingBucketCfn = this.loggingBucket.node.defaultChild as s3.CfnBucket;
    loggingBucketCfn.addMetadata("checkov", {
      skip: [
        {
          id: "CKV_AWS_18",
          comment: "Logging bucket - enabling access logging would create infinite loop",
        },
      ],
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
    // SECURITY: WAF is required (Checkov CKV_AWS_68)
    // -------------------------------------------------------------------------

    this.distribution = new cloudfront.Distribution(
      this,
      "AdminWebDistribution",
      {
        defaultRootObject: "index.html",
        domainNames: [domainName.valueAsString],
        certificate,
        // SECURITY: WAF Web ACL is required for CloudFront protection (Checkov CKV_AWS_68)
        webAclId: wafWebAclArn.valueAsString,
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
  }
}
