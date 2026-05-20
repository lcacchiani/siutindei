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

Deploy the CDK stack via GitHub Actions **Deploy Backend** (`public website`
or `all stacks`). Deploy static site artifacts with
**Deploy Public Website Staging** / **Promote Public Website Release**
(`.github/workflows/deploy-public-www.yml`,
`.github/workflows/promote-public-www.yml`).

| Parameter | Purpose |
|-----------|---------|
| `PublicWwwDomainName` | Production CloudFront alias (e.g. `siutindei-www.lx-software.com`). |
| `PublicWwwCertificateArn` | ACM cert ARN in **us-east-1** that covers the production alias. |
| `PublicWwwStagingDomainName` | Staging CloudFront alias (e.g. `siutindei-www-staging.lx-software.com`). |
| `PublicWwwStagingCertificateArn` | ACM cert ARN in **us-east-1** that covers the staging alias. |
| `PublicWwwSiteName` | Brand name baked into static export metadata (CI default when `NEXT_PUBLIC_SITE_NAME` GitHub var is unset). |
| `PublicWwwSiteTagline` | Hero/tagline copy for the static export (CI default when `NEXT_PUBLIC_SITE_TAGLINE` var is unset). |
| `PublicWwwContactEmail` | Footer/maintenance contact email (falls back to `AuthEmailFromAddress` when omitted). |
| `WafWebAclArn` | (Optional) us-east-1 WAF WebACL ARN; reuse the admin-web ACL. |

Before the first `cdk deploy`, ensure the ACM certificate listed in
`PublicWwwCertificateArn`/`PublicWwwStagingCertificateArn` includes the public
website hostnames as Subject Alternative Names. The default values reuse the
same us-east-1 certificate as the admin web (`siutindei.lx-software.com`);
hostnames must follow the `siutindei-*` pattern on `lx-software.com` (e.g.
`siutindei-www.lx-software.com`, `siutindei-www-staging.lx-software.com`).
Extend the certificate SANs if a hostname is not yet covered before deploying.
