import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

// -----------------------------------------------------------------------------
// PublicWwwStack
//
// Hosts the LX Software Siu Tin Dei marketing/public website. The stack
// provisions two parallel environments (production + staging) so that releases
// can be promoted from staging to production via S3 artifact copy without any
// rebuild step (see scripts/deploy/deploy-public-www.sh).
//
// Architecture per environment:
//   * S3 origin bucket (BLOCK_ALL, SSL only, versioned, server access logs)
//   * S3 logging bucket (BLOCK_ALL, SSL only, versioned, lifecycle rules)
//   * CloudFront distribution (TLS_V1_2_2021, HTTP2/3, OAI, custom domain)
//   * CloudFront Function: path-rewrite for Next.js static-export trailing
//     slash semantics
//   * Response headers policy: HSTS, CSP, Permissions-Policy, X-Frame DENY,
//     Referrer-Policy, X-Content-Type-Options, XSS-Protection, X-Robots-Tag
//     (staging-only noindex)
//   * Optional WAF (us-east-1) attached via CfnCondition; reuses the same WAF
//     WebACL ARN as the admin web distribution.
//
// Future extension (NOT included in scaffolding):
//   * /www/* CloudFront behavior with allow-list CloudFront Function pointing
//     at the API Gateway origin (see evolvesprouts public-www-stack for the
//     full pattern). When adding that, serialize CloudFront Function updates
//     within an environment to avoid hitting the regional CloudFront Functions
//     API rate limit (`addDependency` chain).
// -----------------------------------------------------------------------------

interface WebsiteEnvironmentConfig {
  readonly idPrefix: "PublicWww" | "PublicWwwStaging";
  readonly environmentLabel: "production" | "staging";
  readonly domainName: string;
  readonly certificateArn: string;
  readonly bucketNamePrefix: string;
  readonly loggingBucketNamePrefix: string;
  readonly addNoIndexHeader: boolean;
  readonly hasWafWebAclArn: cdk.CfnCondition;
  readonly wafWebAclArn: cdk.CfnParameter;
}

interface WebsiteEnvironmentResources {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly loggingBucket: s3.Bucket;
}

const PUBLIC_WWW_HEADER_CONTENT_SECURITY_POLICY = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const PUBLIC_WWW_PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), gyroscope=(), " +
  "magnetometer=(), microphone=(), payment=(), usb=()";

export class PublicWwwStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly loggingBucket: s3.Bucket;
  public readonly stagingBucket: s3.Bucket;
  public readonly stagingDistribution: cloudfront.Distribution;
  public readonly stagingLoggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add("Organization", "LX Software");
    cdk.Tags.of(this).add("Project", "Siu Tin Dei");
    cdk.Tags.of(this).add("Component", "Public Website");

    const productionDomainName = new cdk.CfnParameter(
      this,
      "PublicWwwDomainName",
      {
        type: "String",
        description:
          "Custom domain for production public website (CloudFront alias).",
      },
    );

    const productionCertificateArn = new cdk.CfnParameter(
      this,
      "PublicWwwCertificateArn",
      {
        type: "String",
        description:
          "ACM certificate ARN (us-east-1) for the production public website.",
        allowedPattern: "^arn:aws:acm:us-east-1:[0-9]+:certificate/.+$",
        constraintDescription:
          "Must be a us-east-1 ACM certificate ARN (CloudFront requirement).",
      },
    );

    const stagingDomainName = new cdk.CfnParameter(
      this,
      "PublicWwwStagingDomainName",
      {
        type: "String",
        description:
          "Custom domain for staging public website (CloudFront alias).",
      },
    );

    const stagingCertificateArn = new cdk.CfnParameter(
      this,
      "PublicWwwStagingCertificateArn",
      {
        type: "String",
        description:
          "ACM certificate ARN (us-east-1) for the staging public website.",
        allowedPattern: "^arn:aws:acm:us-east-1:[0-9]+:certificate/.+$",
        constraintDescription:
          "Must be a us-east-1 ACM certificate ARN (CloudFront requirement).",
      },
    );

    // Optional WAF, reusing the same WebACL as admin web. The admin web stack
    // requires the WAF; here we keep it conditional so that the public website
    // can deploy to lower environments before the WAF is provisioned.
    const wafWebAclArn = new cdk.CfnParameter(this, "WafWebAclArn", {
      type: "String",
      default: "",
      description:
        "Optional WAF WebACL ARN (us-east-1) for CloudFront protection. " +
        "Reuse the admin-web WAF when set.",
      allowedPattern: "^$|arn:aws:wafv2:us-east-1:[0-9]+:global/webacl/.+$",
      constraintDescription:
        "Must be empty or a valid WAF WebACL ARN from us-east-1.",
    });
    const hasWafWebAclArn = new cdk.CfnCondition(this, "HasWafWebAclArn", {
      expression: cdk.Fn.conditionNot(
        cdk.Fn.conditionEquals(wafWebAclArn.valueAsString, ""),
      ),
    });

    const productionResources = this.createWebsiteEnvironment({
      idPrefix: "PublicWww",
      environmentLabel: "production",
      domainName: productionDomainName.valueAsString,
      certificateArn: productionCertificateArn.valueAsString,
      // Bucket name composition: prefix + "-" + accountId(12) + "-" + region.
      // ap-southeast-1 (14) + 12 + 2 dashes = 28; prefix budget = 35.
      // "lxsoftware-siutindei-www" = 23 → total 51 ≤ 63 ✅
      bucketNamePrefix: "lxsoftware-siutindei-www",
      // "lxsoftware-siutindei-www-logs" = 28 → total 56 ≤ 63 ✅
      loggingBucketNamePrefix: "lxsoftware-siutindei-www-logs",
      addNoIndexHeader: false,
      hasWafWebAclArn,
      wafWebAclArn,
    });
    this.bucket = productionResources.bucket;
    this.distribution = productionResources.distribution;
    this.loggingBucket = productionResources.loggingBucket;

    const stagingResources = this.createWebsiteEnvironment({
      idPrefix: "PublicWwwStaging",
      environmentLabel: "staging",
      domainName: stagingDomainName.valueAsString,
      certificateArn: stagingCertificateArn.valueAsString,
      // "lxsoftware-siutindei-stg-www" = 28 → total 56 ≤ 63 ✅
      bucketNamePrefix: "lxsoftware-siutindei-stg-www",
      // "lxsoftware-siutindei-stg-www-logs" = 33 → total 61 ≤ 63 ✅
      loggingBucketNamePrefix: "lxsoftware-siutindei-stg-www-logs",
      addNoIndexHeader: true,
      hasWafWebAclArn,
      wafWebAclArn,
    });
    this.stagingBucket = stagingResources.bucket;
    this.stagingDistribution = stagingResources.distribution;
    this.stagingLoggingBucket = stagingResources.loggingBucket;

    new cdk.CfnOutput(this, "PublicWwwBucketName", {
      value: this.bucket.bucketName,
    });
    new cdk.CfnOutput(this, "PublicWwwDistributionId", {
      value: this.distribution.distributionId,
    });
    new cdk.CfnOutput(this, "PublicWwwDistributionDomain", {
      value: this.distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "PublicWwwLoggingBucketName", {
      value: this.loggingBucket.bucketName,
      description: "S3 bucket for CloudFront and S3 access logs (production).",
    });

    new cdk.CfnOutput(this, "PublicWwwStagingBucketName", {
      value: this.stagingBucket.bucketName,
    });
    new cdk.CfnOutput(this, "PublicWwwStagingDistributionId", {
      value: this.stagingDistribution.distributionId,
    });
    new cdk.CfnOutput(this, "PublicWwwStagingDistributionDomain", {
      value: this.stagingDistribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "PublicWwwStagingLoggingBucketName", {
      value: this.stagingLoggingBucket.bucketName,
      description: "S3 bucket for CloudFront and S3 access logs (staging).",
    });
  }

  private createWebsiteEnvironment(
    config: WebsiteEnvironmentConfig,
  ): WebsiteEnvironmentResources {
    const loggingBucketName = [
      config.loggingBucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const loggingBucket = new s3.Bucket(this, `${config.idPrefix}LoggingBucket`, {
      bucketName: loggingBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "ExpireOldLogs",
          enabled: true,
          expiration: cdk.Duration.days(90),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const loggingBucketCfn = loggingBucket.node.defaultChild as s3.CfnBucket;
    loggingBucketCfn.addMetadata("checkov", {
      skip: [
        {
          id: "CKV_AWS_18",
          comment: "Logging bucket cannot self-log without infinite recursion.",
        },
      ],
    });

    const bucketName = [
      config.bucketNamePrefix,
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");
    const bucket = new s3.Bucket(this, `${config.idPrefix}Bucket`, {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: loggingBucket,
      serverAccessLogsPrefix: "s3-access-logs/",
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      `${config.idPrefix}Oai`,
      {
        comment: `OAI for ${config.environmentLabel} public website CloudFront distribution.`,
      },
    );
    bucket.grantRead(originAccessIdentity);

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      `${config.idPrefix}Certificate`,
      config.certificateArn,
    );

    const websiteOrigin = origins.S3BucketOrigin.withOriginAccessIdentity(
      bucket,
      {
        originAccessIdentity,
      },
    );

    // Path rewrite for Next.js static export: incoming request paths without
    // a file extension or with a trailing slash get mapped to "<path>/index.html"
    // so that `output: 'export'` builds resolve cleanly through CloudFront.
    const pathRewriteFunction = new cloudfront.Function(
      this,
      `${config.idPrefix}PathRewriteFunction`,
      {
        comment:
          "Rewrite extensionless and trailing-slash paths to index.html for static export.",
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.startsWith('/_next/')) {
    return request;
  }

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  if (uri.indexOf('.') === -1) {
    request.uri = uri + '/index.html';
  }

  return request;
}
`),
      },
    );

    const customHeaders: cloudfront.ResponseCustomHeader[] = [
      {
        header: "Permissions-Policy",
        value: PUBLIC_WWW_PERMISSIONS_POLICY,
        override: true,
      },
    ];
    if (config.addNoIndexHeader) {
      customHeaders.push({
        header: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive",
        override: true,
      });
    }

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      `${config.idPrefix}ResponseHeadersPolicy`,
      {
        comment: `Security headers for ${config.environmentLabel} public website distribution.`,
        customHeadersBehavior: {
          customHeaders,
        },
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: PUBLIC_WWW_HEADER_CONTENT_SECURITY_POLICY,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
      },
    );

    const distribution = new cloudfront.Distribution(
      this,
      `${config.idPrefix}Distribution`,
      {
        defaultRootObject: "index.html",
        domainNames: [config.domainName],
        certificate,
        minimumProtocolVersion:
          cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        enableLogging: true,
        logBucket: loggingBucket,
        logFilePrefix: "cloudfront-access-logs/",
        logIncludesCookies: false,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: cdk.Duration.minutes(1),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: cdk.Duration.minutes(1),
          },
        ],
        defaultBehavior: {
          origin: websiteOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy,
          functionAssociations: [
            {
              function: pathRewriteFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },
    );

    const cfnDistribution = distribution.node
      .defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.WebACLId",
      cdk.Fn.conditionIf(
        config.hasWafWebAclArn.logicalId,
        config.wafWebAclArn.valueAsString,
        cdk.Aws.NO_VALUE,
      ),
    );

    return {
      bucket,
      distribution,
      loggingBucket,
    };
  }
}
