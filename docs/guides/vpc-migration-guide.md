# VPC Migration Guide: Removing NAT Gateway

This guide explains how to migrate from a standard VPC (with NAT Gateway) to a cost-optimized VPC (with VPC Endpoints only), saving approximately **$32-40/month**.

## Overview

### Current Architecture (Standard VPC)
- NAT Gateway: ~$32/month base + $0.045/GB data processing
- Private subnets with internet access via NAT
- All AWS service traffic routes through NAT Gateway

### Target Architecture (Cost-Optimized VPC)
- No NAT Gateway: $0/month
- Private isolated subnets (no internet access)
- VPC Endpoints route AWS service traffic directly
- Gateway Endpoints (S3, DynamoDB): FREE
- Interface Endpoints (Secrets Manager, STS, CloudWatch): ~$7-10/month each

### Estimated Savings
- **Minimum**: $32/month (NAT Gateway base cost)
- **Typical**: $40-60/month (including data processing savings)
- **Annual**: $400-700/year

---

## Prerequisites

Before starting the migration:

1. **Schedule a maintenance window** - Database migration requires downtime
2. **Create a database snapshot** - For disaster recovery
3. **Document current endpoints** - API Gateway URLs, CloudFront distributions
4. **Notify stakeholders** - Users may experience brief service interruption

---

## Migration Strategy

### Option A: Blue-Green Deployment (Recommended)

Deploy a new stack alongside the existing one, then switch traffic.

#### Step 1: Prepare the New Stack

Create a new environment with cost-optimized VPC:

```bash
# Set environment variables for the new stack
export COST_OPTIMIZED_VPC=true
export AWS_REGION=ap-southeast-1

# Use a different stack name or resource prefix
# This creates resources alongside the existing ones
```

#### Step 2: Create Database Snapshot

```bash
# Create a snapshot of the existing database
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier lxsoftware-siutindei-db-cluster \
  --db-cluster-snapshot-identifier siutindei-pre-migration-$(date +%Y%m%d)
```

#### Step 3: Deploy New Stack

```bash
# Deploy the new stack with cost-optimized VPC
cd backend/infrastructure
COST_OPTIMIZED_VPC=true npx cdk deploy lxsoftware-siutindei-v2
```

#### Step 4: Restore Database in New VPC

```bash
# Restore from snapshot in the new VPC
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier lxsoftware-siutindei-db-cluster-v2 \
  --snapshot-identifier siutindei-pre-migration-YYYYMMDD \
  --vpc-security-group-ids sg-new-db-security-group \
  --db-subnet-group-name new-vpc-db-subnet-group \
  --engine aurora-postgresql \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=2
```

#### Step 5: Verify New Environment

1. Test all API endpoints against the new stack
2. Verify database connectivity
3. Check CloudWatch logs for errors
4. Run integration tests

#### Step 6: Switch Traffic

Update DNS/API Gateway to point to new resources:

```bash
# Update Route 53 records (if using custom domain)
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch file://dns-switch.json
```

#### Step 7: Cleanup Old Stack

After verifying the new stack works correctly (wait at least 24-48 hours):

```bash
# Delete the old stack
npx cdk destroy lxsoftware-siutindei-old

# Delete old database cluster (after confirming data migration)
aws rds delete-db-cluster \
  --db-cluster-identifier lxsoftware-siutindei-db-cluster \
  --skip-final-snapshot
```

---

### Option B: In-Place Migration (Advanced)

This approach modifies the existing stack but requires more manual intervention.

#### Step 1: Export Existing Resources

```bash
# Document all resource IDs
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*siutindei*"
aws rds describe-db-clusters --db-cluster-identifier lxsoftware-siutindei-db-cluster
```

#### Step 2: Modify CloudFormation to Import Existing VPC

Update `api-stack.ts` to use `EXISTING_VPC_ID`:

```bash
export EXISTING_VPC_ID=vpc-xxxxxxxx
```

#### Step 3: Create New VPC Manually

```bash
# Create new cost-optimized VPC via AWS Console or CLI
aws ec2 create-vpc --cidr-block 10.1.0.0/16 --tag-specifications ...
```

#### Step 4: Migrate Resources

This requires careful coordination:
1. Create new subnets in new VPC
2. Create new security groups
3. Migrate Lambda functions (update VPC config)
4. Migrate RDS (requires snapshot/restore)
5. Update all references

---

## Environment Variable Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `COST_OPTIMIZED_VPC` | Enable cost-optimized VPC (no NAT) | `false` |
| `EXISTING_VPC_ID` | Use existing VPC instead of creating new | - |

---

## Rollback Plan

If issues occur during migration:

### Immediate Rollback (< 1 hour)
```bash
# Switch DNS back to old stack
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch file://dns-rollback.json
```

### Full Rollback
1. Keep old stack running until migration is verified
2. Old database remains unchanged during blue-green deployment
3. Simply switch traffic back to old endpoints

---

## Post-Migration Checklist

- [ ] All API endpoints responding correctly
- [ ] Database queries executing successfully
- [ ] Lambda functions connecting to RDS Proxy
- [ ] CloudWatch logs flowing properly
- [ ] No NAT Gateway in new VPC
- [ ] VPC Endpoints configured and working
- [ ] Old stack resources deleted
- [ ] Cost savings visible in AWS Cost Explorer (after ~24 hours)

---

## Troubleshooting

### Lambda Cannot Connect to Database
- Verify RDS Proxy security group allows Lambda security group
- Check VPC Endpoint for RDS is configured
- Verify Lambda is in correct subnets

### Lambda Cannot Access Secrets Manager
- Verify Secrets Manager VPC Endpoint exists
- Check security group allows HTTPS (443) from Lambda

### Lambda Cannot Write Logs
- Verify CloudWatch Logs VPC Endpoint exists
- Check IAM permissions for logging

### S3 Access Issues
- S3 Gateway Endpoint should be automatically configured
- Verify endpoint policy allows access to required buckets

---

## Cost Comparison

| Component | Standard VPC | Cost-Optimized VPC |
|-----------|--------------|-------------------|
| NAT Gateway (base) | $32.40/month | $0 |
| NAT Gateway (data) | ~$10-20/month | $0 |
| S3 Gateway Endpoint | $0 | $0 |
| DynamoDB Gateway Endpoint | $0 | $0 |
| Secrets Manager Endpoint | $0 (via NAT) | ~$7.30/month |
| STS Endpoint | $0 (via NAT) | ~$7.30/month |
| CloudWatch Logs Endpoint | $0 (via NAT) | ~$7.30/month |
| **Total** | **~$45-55/month** | **~$22/month** |
| **Savings** | - | **~$25-35/month** |

Note: Interface endpoint costs are $0.01/hour per AZ. With 2 AZs and 3 endpoints: 3 × 2 × $0.01 × 730 hours = ~$44/month. However, this is still cheaper than NAT Gateway data processing for most workloads.

---

## Questions?

For additional support, consult:
- [AWS VPC Endpoints Documentation](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)
- [Aurora Migration Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Migration.html)
