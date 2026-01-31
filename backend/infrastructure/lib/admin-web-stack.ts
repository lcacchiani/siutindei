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
    const adminWebWafArn = new cdk.CfnParameter(this, "AdminWebWafArn", {
      type: "String",
      default: "",
      description:
        "Optional WAFv2 WebACL ARN for CloudFront. If empty in us-east-1, " +
        "a managed WebACL is created.",
    });

    const bucketName = [
      name("admin-web"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");
    const accessLogsBucketName = [
      name("admin-web-logs"),
      cdk.Aws.ACCOUNT_ID,
      cdk.Aws.REGION,
    ].join("-");

    const accessLogsBucket = new s3.Bucket(this, "AdminWebAccessLogsBucket", {
      bucketName: accessLogsBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
    });
    const accessLogsBucketResource =
      accessLogsBucket.node.defaultChild as s3.CfnBucket;
    accessLogsBucketResource.addMetadata("checkov:skip", [
      {
        id: "CKV_AWS_18",
        comment:
          "Access logs bucket does not log itself to avoid recursion.",
      },
    ]);

    this.bucket = new s3.Bucket(this, "AdminWebBucket", {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "admin-web/s3/",
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

    const isUsEast1Expression = cdk.Fn.conditionEquals(
      cdk.Aws.REGION,
      "us-east-1"
    );
    const useManagedWaf = new cdk.CfnCondition(this, "UseManagedWaf", {
      expression: cdk.Fn.conditionAnd(
        cdk.Fn.conditionEquals(adminWebWafArn.valueAsString, ""),
        isUsEast1Expression
      ),
    });
    new cdk.CfnRule(this, "RequireAdminWebWafArn", {
      ruleCondition: cdk.Fn.conditionNot(isUsEast1Expression),
      assertions: [
        {
          assert: cdk.Fn.conditionNot(
            cdk.Fn.conditionEquals(adminWebWafArn.valueAsString, "")
          ),
          assertDescription:
            "AdminWebWafArn must be set when deploying outside us-east-1.",
        },
      ],
    });

    const managedWebAcl = new wafv2.CfnWebACL(this, "AdminWebWaf", {
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name("admin-web-waf"),
        sampledRequestsEnabled: true,
      },
      rules: [
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
            metricName: name("admin-web-waf-common"),
            sampledRequestsEnabled: true,
          },
        },
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
            metricName: name("admin-web-waf-bad-inputs"),
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    managedWebAcl.cfnOptions.condition = useManagedWaf;
    const webAclId = cdk.Token.asString(
      cdk.Fn.conditionIf(
        useManagedWaf.logicalId,
        managedWebAcl.attrArn,
        adminWebWafArn.valueAsString
      )
    );

    this.distribution = new cloudfront.Distribution(
      this,
      "AdminWebDistribution",
      {
        defaultRootObject: "index.html",
        domainNames: [domainName.valueAsString],
        certificate,
        logBucket: accessLogsBucket,
        logFilePrefix: "admin-web/cloudfront/",
        enableLogging: true,
        webAclId,
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
  }
}
