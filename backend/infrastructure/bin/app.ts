import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";
import { AdminWebStack } from "../lib/admin-web-stack";
import { WafStack } from "../lib/waf-stack";

const app = new cdk.App();

const bootstrapQualifier = process.env.CDK_BOOTSTRAP_QUALIFIER;
if (bootstrapQualifier) {
  app.node.setContext("@aws-cdk/core:bootstrapQualifier", bootstrapQualifier);
}

new ApiStack(app, "lxsoftware-siutindei", {
  description: "LX Software Siu Tin Dei",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined,
});

new AdminWebStack(app, "lxsoftware-siutindei-admin-web", {
  description: "LX Software Siu Tin Dei Admin Web",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined,
});

// WAF Stack for CloudFront protection
// IMPORTANT: Must be deployed to us-east-1 (required for CloudFront WAF)
// Deploy with: cdk deploy lxsoftware-siutindei-waf --region us-east-1
new WafStack(app, "lxsoftware-siutindei-waf", {
  description: "LX Software Siu Tin Dei WAF for CloudFront (us-east-1)",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // WAF for CloudFront MUST be in us-east-1
    region: "us-east-1",
  },
  synthesizer: bootstrapQualifier
    ? new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier })
    : undefined,
  crossRegionReferences: true,
});
