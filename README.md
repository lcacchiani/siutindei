# siutindei

## Deployment prerequisites (AWS + GitHub OIDC)

The GitHub Actions workflows assume an IAM role named `GitHubActionsRole` in
AWS account `588024549699`. To allow OIDC-based role assumption, complete these
steps once per account/region.

### 1) Create the GitHub OIDC provider

In AWS Console: **IAM → Identity providers → Add provider**

- Provider type: **OpenID Connect**
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

### 2) Update the IAM role trust policy

Apply the following trust policy to the `GitHubActionsRole`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::588024549699:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:lcacchiani/siutindei:*"
        }
      }
    }
  ]
}
```
