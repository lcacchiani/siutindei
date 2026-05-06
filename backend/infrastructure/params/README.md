# CDK parameter files

Use `production.json` as a template for CDK parameters.

## Local deploy

```bash
cd backend/infrastructure
export CDK_PARAM_FILE=params/production.json
npx cdk deploy --require-approval never
```

## GitHub Actions

Set the repository variable `CDK_PARAM_FILE` to the path you want CI to use
(`params/production.json` by default).

> Keep secrets out of the repo. For production, use a private parameter file
> stored outside of git or generated in CI from secrets.

## Public Website (`PublicWwwStack`)

The public website stack provisions both production and staging environments
in a single `lxsoftware-siutindei-public-www` CloudFormation stack.

| Parameter | Purpose |
|-----------|---------|
| `PublicWwwDomainName` | Production CloudFront alias (e.g. `www.siutindei.lx-software.com`). |
| `PublicWwwCertificateArn` | ACM cert ARN in **us-east-1** that covers the production alias. |
| `PublicWwwStagingDomainName` | Staging CloudFront alias (e.g. `www-staging.siutindei.lx-software.com`). |
| `PublicWwwStagingCertificateArn` | ACM cert ARN in **us-east-1** that covers the staging alias. |
| `WafWebAclArn` | (Optional) us-east-1 WAF WebACL ARN; reuse the admin-web ACL. |

Before the first `cdk deploy`, ensure the ACM certificate listed in
`PublicWwwCertificateArn`/`PublicWwwStagingCertificateArn` includes the public
website hostnames as Subject Alternative Names. The default values reuse the
existing admin web certificate; if it does not yet cover these hostnames, issue
a wildcard `*.siutindei.lx-software.com` (or extend the existing cert) before
deploying.
