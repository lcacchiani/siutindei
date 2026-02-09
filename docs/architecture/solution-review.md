# Solution Review: Security, Performance & Cost Analysis

This document provides a comprehensive review of the Siu Tin Dei solution with recommendations for security hardening, performance improvements, refactoring suggestions, and AWS expense estimates.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Security Review & Hardening](#security-review--hardening)
3. [Performance Improvements](#performance-improvements)
4. [Refactoring Recommendations](#refactoring-recommendations)
5. [AWS Expense Estimates](#aws-expense-estimates)
6. [Implementation Priority](#implementation-priority)

---

## Executive Summary

The Siu Tin Dei solution demonstrates solid architectural foundations with:

**Strengths:**
- IAM authentication for RDS Proxy (excellent security practice)
- Device attestation for mobile API access
- WAF protection with AWS managed rules
- KMS encryption for secrets and logs
- Proper separation of concerns (repository pattern, Lambda functions)
- Comprehensive input validation with length limits
- CORS properly configured (not `ALL_ORIGINS`)
- Passwordless authentication with Cognito custom auth triggers

**Areas for Improvement:**
- Rate limiting could be more granular
- Connection pooling optimization needed for Lambda
- Missing request/response validation schemas
- Database query optimization opportunities
- Cost optimization through reserved capacity

---

## Security Review & Hardening

### 1. Authentication & Authorization

#### Current State
- ✅ Cognito-based authentication with custom passwordless flow
- ✅ Device attestation (Firebase App Check) for mobile API
- ✅ Group-based authorization (admin, manager groups)
- ✅ Fail-closed mode for attestation in production

#### Recommendations

**HIGH PRIORITY:**

1. **Add JWT Token Validation in Cognito Group Authorizer**

```python
# backend/lambda/authorizers/cognito_group/handler.py
# Currently decodes JWT without verification - should verify signature

import jwt
from jwt import PyJWKClient

def _verify_and_decode_jwt(token: str, user_pool_id: str, region: str) -> dict[str, Any]:
    """Verify JWT signature and decode claims."""
    jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=os.getenv("COGNITO_CLIENT_ID"),
        issuer=f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}",
    )
```

2. **Add Token Expiration Check**

```python
# Ensure tokens aren't expired before granting access
if claims.get("exp", 0) < time.time():
    logger.warning("Token has expired")
    return _policy("Deny", method_arn, "expired", {"reason": "token_expired"})
```

3. **Implement API Key Rotation**

```typescript
// backend/infrastructure/lib/api-stack.ts
// Add scheduled rotation for the mobile API key

const apiKeyRotationLambda = createPythonFunction("ApiKeyRotationFunction", {
  handler: "lambda/api_key_rotation/handler.lambda_handler",
  timeout: cdk.Duration.seconds(30),
  environment: {
    API_KEY_SECRET_ARN: apiKeySecret.secretArn,
  },
});

new events.Rule(this, "ApiKeyRotationSchedule", {
  schedule: events.Schedule.rate(cdk.Duration.days(90)),
  targets: [new targets.LambdaFunction(apiKeyRotationLambda)],
});
```

**MEDIUM PRIORITY:**

4. **Add Request Signing for Admin API**

Consider adding request signing for sensitive admin operations to prevent replay attacks:

```python
# Add request timestamp validation
from datetime import datetime, timezone

def _validate_request_timestamp(event: Mapping[str, Any]) -> None:
    timestamp = event.get("headers", {}).get("x-request-timestamp")
    if not timestamp:
        raise ValidationError("Missing request timestamp")
    
    request_time = datetime.fromisoformat(timestamp)
    now = datetime.now(timezone.utc)
    
    # Reject requests older than 5 minutes
    if abs((now - request_time).total_seconds()) > 300:
        raise ValidationError("Request timestamp too old or in future")
```

5. **Add IP Allowlisting for Admin Console**

```typescript
// backend/infrastructure/lib/waf-stack.ts
// Add IP allowlist rule for admin endpoints

{
  name: "AdminIPAllowlist",
  priority: 0,
  action: { allow: {} },
  statement: {
    ipSetReferenceStatement: {
      arn: adminIpSet.attrArn,
    },
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: name("admin-ip-allowlist"),
    sampledRequestsEnabled: true,
  },
}
```

### 2. Database Security

#### Current State
- ✅ IAM authentication for RDS Proxy
- ✅ TLS enforced (`sslmode=require`)
- ✅ Secrets Manager for credentials
- ✅ Separate database users (app, admin)

#### Recommendations

**HIGH PRIORITY:**

1. **Add Row-Level Security (RLS) for Multi-Tenancy**

```sql
-- backend/db/alembic/versions/xxxx_add_rls_policies.py

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy for managers - can only see their own organizations
CREATE POLICY org_manager_policy ON organizations
    USING (manager_id = current_setting('app.current_user_id', true));

-- Apply similar policies to locations, activities, etc.
```

2. **Add Database Audit Logging**

```typescript
// backend/infrastructure/lib/constructs/database.ts

const cluster = new rds.DatabaseCluster(this, "Cluster", {
  // ... existing config
  cloudwatchLogsExports: ["postgresql", "audit"],  // Add audit log
  parameters: {
    "log_statement": "all",
    "log_connections": "1",
    "log_disconnections": "1",
    "pgaudit.log": "all",
  },
});
```

**MEDIUM PRIORITY:**

3. **Implement Query Parameterization Validation**

Add a linting rule to ensure all queries use parameterized statements:

```python
# tests/test_sql_injection.py

def test_no_string_interpolation_in_queries():
    """Ensure no f-strings or % formatting in SQL queries."""
    import ast
    import glob
    
    for filepath in glob.glob("backend/src/**/*.py", recursive=True):
        with open(filepath) as f:
            tree = ast.parse(f.read())
            # Check for f-strings near execute() calls
            # ... validation logic
```

### 3. Input Validation & Sanitization

#### Current State
- ✅ Length limits on string inputs
- ✅ UUID validation
- ✅ Coordinate validation
- ✅ Currency and language code validation

#### Recommendations

**HIGH PRIORITY:**

1. **Add Content-Type Validation**

```python
# backend/src/app/api/admin.py

def _validate_content_type(event: Mapping[str, Any]) -> None:
    """Validate Content-Type header for POST/PUT requests."""
    method = event.get("httpMethod", "")
    if method not in ("POST", "PUT", "PATCH"):
        return
    
    content_type = _get_header(event, "content-type")
    if not content_type or "application/json" not in content_type.lower():
        raise ValidationError(
            "Content-Type must be application/json",
            field="Content-Type",
        )
```

2. **Add Request Size Limits**

```typescript
// backend/infrastructure/lib/api-stack.ts

const api = new apigateway.RestApi(this, "SiutindeiApi", {
  // ... existing config
  minimumCompressionSize: 1024,  // Enable compression
  // Note: API Gateway has a default 10MB limit
});

// Add request validator
const requestValidator = new apigateway.RequestValidator(this, "RequestValidator", {
  restApi: api,
  validateRequestBody: true,
  validateRequestParameters: true,
});
```

3. **Implement Schema Validation with Pydantic**

```python
# backend/src/app/api/schemas.py

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from decimal import Decimal

class OrganizationCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    manager_id: str = Field(..., pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    media_urls: Optional[List[str]] = Field(default_factory=list, max_items=20)
    
    @validator('media_urls', each_item=True)
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Invalid URL scheme')
        return v

class ActivityCreateSchema(BaseModel):
    org_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    age_min: int = Field(..., ge=0, le=120)
    age_max: int = Field(..., ge=0, le=120)
    
    @validator('age_max')
    def age_range_valid(cls, v, values):
        if 'age_min' in values and v <= values['age_min']:
            raise ValueError('age_max must be greater than age_min')
        return v
```

### 4. API Security

#### Current State
- ✅ WAF with AWS managed rules
- ✅ Rate limiting (1000 req/5min per IP)
- ✅ API key for public endpoints
- ✅ CORS restricted to specific origins

#### Recommendations

**HIGH PRIORITY:**

1. **Add Per-Endpoint Rate Limiting**

```typescript
// backend/infrastructure/lib/api-stack.ts

// More granular rate limiting for sensitive endpoints
const adminRateLimitRule: wafv2.CfnWebACL.RuleProperty = {
  name: "AdminEndpointRateLimit",
  priority: 5,
  action: { block: {} },
  statement: {
    rateBasedStatement: {
      limit: 100,  // Lower limit for admin endpoints
      aggregateKeyType: "FORWARDED_IP",
      forwardedIPConfig: {
        headerName: "X-Forwarded-For",
        fallbackBehavior: "MATCH",
      },
      scopeDownStatement: {
        byteMatchStatement: {
          searchString: "/v1/admin/",
          fieldToMatch: { uriPath: {} },
          textTransformations: [{ priority: 0, type: "LOWERCASE" }],
          positionalConstraint: "STARTS_WITH",
        },
      },
    },
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: name("admin-rate-limit"),
    sampledRequestsEnabled: true,
  },
};
```

2. **Add Security Headers**

```python
# backend/src/app/utils/responses.py

def get_security_headers() -> dict[str, str]:
    """Return security headers for all responses."""
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    }
```

3. **Add SQL Injection Protection Rule to WAF**

```typescript
// backend/infrastructure/lib/waf-stack.ts

{
  name: "AWSManagedRulesSQLiRuleSet",
  priority: 5,
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
```

### 5. Secrets Management

#### Current State
- ✅ Secrets Manager for database credentials
- ✅ KMS encryption for secrets
- ✅ `noEcho: true` for CDK parameters

#### Recommendations

**MEDIUM PRIORITY:**

1. **Implement Secret Rotation**

```typescript
// backend/infrastructure/lib/constructs/database.ts

// Add automatic rotation for database credentials
dbCredentialsSecret.addRotationSchedule("RotationSchedule", {
  automaticallyAfter: cdk.Duration.days(30),
  rotationLambda: rotationLambda,
});
```

2. **Add Secret Access Logging**

```typescript
// Monitor secret access via CloudTrail
const secretAccessTrail = new cloudtrail.Trail(this, "SecretAccessTrail", {
  sendToCloudWatchLogs: true,
  cloudWatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
});

secretAccessTrail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [
  `arn:aws:secretsmanager:${region}:${account}:secret:*`,
]);
```

---

## Performance Improvements

### 1. Database Performance

#### Current State
- ✅ Aurora Serverless v2 (auto-scaling)
- ✅ RDS Proxy for connection pooling
- ✅ Appropriate indexes on search columns

#### Recommendations

**HIGH PRIORITY:**

1. **Add Read Replicas for Search Traffic**

```typescript
// backend/infrastructure/lib/constructs/database.ts

const readerInstance = rds.ClusterInstance.serverlessV2("reader", {
  instanceIdentifier: name("db-reader"),
  scaleWithWriter: true,
});

const cluster = new rds.DatabaseCluster(this, "Cluster", {
  // ... existing config
  readers: [readerInstance],
});
```

2. **Optimize Search Query**

```python
# backend/src/app/db/queries.py

# Add composite indexes for common search patterns
# Run as Alembic migration:

"""
CREATE INDEX CONCURRENTLY idx_search_composite
ON activity_schedule (schedule_type, day_of_week_utc, start_minutes_utc)
WHERE schedule_type = 'weekly';

CREATE INDEX CONCURRENTLY idx_pricing_search
ON activity_pricing (pricing_type, amount)
INCLUDE (currency, sessions_count);

CREATE INDEX CONCURRENTLY idx_location_district_gin
ON locations USING gin (to_tsvector('english', district));
"""
```

3. **Add Query Result Caching with ElastiCache**

```typescript
// backend/infrastructure/lib/api-stack.ts

// Add ElastiCache for query caching
const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, "CacheSubnetGroup", {
  subnetIds: vpc.privateSubnets.map(s => s.subnetId),
  description: "Subnet group for Redis cache",
});

const cacheCluster = new elasticache.CfnCacheCluster(this, "SearchCache", {
  cacheNodeType: "cache.t4g.micro",
  engine: "redis",
  numCacheNodes: 1,
  vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
  cacheSubnetGroupName: cacheSubnetGroup.ref,
});
```

```python
# backend/src/app/db/cache.py

import redis
import json
import hashlib
from typing import Optional, Any

class SearchCache:
    def __init__(self, redis_url: str, ttl: int = 300):
        self.client = redis.from_url(redis_url)
        self.ttl = ttl
    
    def _make_key(self, filters: dict) -> str:
        """Generate cache key from search filters."""
        serialized = json.dumps(filters, sort_keys=True)
        return f"search:{hashlib.sha256(serialized.encode()).hexdigest()}"
    
    def get(self, filters: dict) -> Optional[Any]:
        key = self._make_key(filters)
        cached = self.client.get(key)
        return json.loads(cached) if cached else None
    
    def set(self, filters: dict, results: Any) -> None:
        key = self._make_key(filters)
        self.client.setex(key, self.ttl, json.dumps(results))
```

### 2. Lambda Performance

#### Current State
- ✅ VPC-attached Lambdas with RDS Proxy
- ❌ No provisioned concurrency
- ❌ Cold start optimization needed

#### Recommendations

**HIGH PRIORITY:**

1. **Add Provisioned Concurrency for Critical Functions**

```typescript
// backend/infrastructure/lib/api-stack.ts

const searchFunctionVersion = searchFunction.currentVersion;
const searchAlias = new lambda.Alias(this, "SearchFunctionAlias", {
  aliasName: "live",
  version: searchFunctionVersion,
  provisionedConcurrentExecutions: 5,
});
```

2. **Optimize Lambda Bundle Size**

```python
# backend/scripts/build_lambda_bundle.py

# Add dependency optimization
EXCLUDE_PACKAGES = [
    "boto3",  # Available in Lambda runtime
    "botocore",
    "pip",
    "setuptools",
    "wheel",
]

# Use Lambda layers for common dependencies
LAYER_PACKAGES = [
    "sqlalchemy",
    "psycopg",
    "pydantic",
]
```

3. **Add Connection Reuse**

```python
# backend/src/app/db/engine.py

from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

@lru_cache(maxsize=1)
def get_engine():
    """Get cached database engine."""
    url = get_database_url()
    
    # Use NullPool for Lambda (RDS Proxy handles pooling)
    return create_engine(
        url,
        poolclass=NullPool,
        echo=False,
        future=True,
        connect_args={
            "connect_timeout": 5,
            "application_name": "siutindei-lambda",
        },
    )
```

### 3. API Gateway Performance

#### Current State
- ✅ API caching enabled (5-minute TTL)
- ✅ Cache cluster size 0.5 GB

#### Recommendations

**MEDIUM PRIORITY:**

1. **Increase Cache Size for High Traffic**

```typescript
// backend/infrastructure/lib/api-stack.ts

deployOptions: {
  // ... existing config
  cacheClusterEnabled: true,
  cacheClusterSize: "1.6",  // Increase from 0.5
  methodOptions: {
    "/v1/activities/search/GET": {
      cachingEnabled: true,
      cacheTtl: cdk.Duration.minutes(10),  // Increase TTL
    },
  },
},
```

2. **Add Response Compression**

```typescript
const api = new apigateway.RestApi(this, "SiutindeiApi", {
  // ... existing config
  minimumCompressionSize: 1024,  // Compress responses > 1KB
});
```

### 4. Frontend Performance (Admin Web)

#### Recommendations

1. **Add Service Worker for Caching**
2. **Implement Optimistic Updates**
3. **Add Pagination Virtualization**

```typescript
// apps/admin_web/src/components/DataTable.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualizedDataTable({ data, rowHeight = 50 }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <DataRow key={item.key} data={data[item.index]} />
        ))}
      </div>
    </div>
  );
}
```

---

## Refactoring Recommendations

### 1. Code Organization

#### High Priority

1. **Extract API Response Builder**

```python
# backend/src/app/utils/api_response.py

from dataclasses import dataclass
from typing import Any, Optional

@dataclass
class ApiResponse:
    status_code: int
    body: dict[str, Any]
    headers: dict[str, str]
    
    @classmethod
    def success(cls, data: Any, status: int = 200) -> "ApiResponse":
        return cls(status, {"data": data}, {})
    
    @classmethod
    def paginated(
        cls,
        items: list[Any],
        next_cursor: Optional[str],
        total: Optional[int] = None,
    ) -> "ApiResponse":
        body = {"items": items, "next_cursor": next_cursor}
        if total is not None:
            body["total"] = total
        return cls(200, body, {})
    
    @classmethod
    def error(cls, message: str, status: int = 400, details: Any = None) -> "ApiResponse":
        body = {"error": message}
        if details:
            body["details"] = details
        return cls(status, body, {})
    
    def to_lambda_response(self, event: Any) -> dict[str, Any]:
        headers = {
            "Content-Type": "application/json",
            **get_security_headers(),
            **get_cors_headers(event),
            **self.headers,
        }
        return {
            "statusCode": self.status_code,
            "headers": headers,
            "body": json.dumps(self.body, default=str),
        }
```

2. **Create Base Handler Class**

```python
# backend/src/app/handlers/base.py

from abc import ABC, abstractmethod
from typing import Any, Mapping

class BaseLambdaHandler(ABC):
    """Base class for Lambda handlers with common error handling."""
    
    def __init__(self):
        configure_logging()
        self.logger = get_logger(self.__class__.__name__)
    
    def handle(self, event: Mapping[str, Any], context: Any) -> dict[str, Any]:
        request_id = event.get("requestContext", {}).get("requestId", "")
        set_request_context(req_id=request_id)
        
        try:
            return self._handle(event, context)
        except ValidationError as exc:
            self.logger.warning(f"Validation error: {exc.message}")
            return ApiResponse.error(exc.message, exc.status_code).to_lambda_response(event)
        except NotFoundError as exc:
            return ApiResponse.error(exc.message, 404).to_lambda_response(event)
        except Exception as exc:
            self.logger.exception("Unexpected error")
            return ApiResponse.error("Internal server error", 500).to_lambda_response(event)
    
    @abstractmethod
    def _handle(self, event: Mapping[str, Any], context: Any) -> dict[str, Any]:
        pass
```

3. **Implement Repository Unit of Work Pattern**

```python
# backend/src/app/db/unit_of_work.py

from contextlib import contextmanager
from sqlalchemy.orm import Session

from app.db.engine import get_engine
from app.db.repositories import (
    OrganizationRepository,
    LocationRepository,
    ActivityRepository,
    ActivityPricingRepository,
    ActivityScheduleRepository,
)

class UnitOfWork:
    def __init__(self, session: Session):
        self.session = session
        self.organizations = OrganizationRepository(session)
        self.locations = LocationRepository(session)
        self.activities = ActivityRepository(session)
        self.pricing = ActivityPricingRepository(session)
        self.schedules = ActivityScheduleRepository(session)
    
    def commit(self):
        self.session.commit()
    
    def rollback(self):
        self.session.rollback()

@contextmanager
def unit_of_work():
    """Context manager for database operations."""
    with Session(get_engine()) as session:
        uow = UnitOfWork(session)
        try:
            yield uow
            uow.commit()
        except Exception:
            uow.rollback()
            raise
```

### 2. API Design

#### Medium Priority

1. **Standardize API Response Format**

```python
# Consistent response envelope
{
    "data": {...},  # or [...] for lists
    "meta": {
        "request_id": "...",
        "timestamp": "...",
    },
    "pagination": {  # only for list responses
        "next_cursor": "...",
        "limit": 50,
    }
}

# Error response
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "...",
        "details": [
            {"field": "name", "message": "..."}
        ]
    },
    "meta": {
        "request_id": "...",
    }
}
```

2. **Add OpenAPI Schema Generation**

```python
# backend/src/app/api/openapi.py

from pydantic import BaseModel
from typing import List, Optional

def generate_openapi_schema() -> dict:
    """Generate OpenAPI 3.0 schema from Pydantic models."""
    return {
        "openapi": "3.0.0",
        "info": {
            "title": "Siu Tin Dei API",
            "version": "1.0.0",
        },
        "paths": {
            "/v1/activities/search": {
                "get": {
                    "summary": "Search activities",
                    "parameters": [...],
                    "responses": {...},
                }
            },
            # ... other endpoints
        },
        "components": {
            "schemas": {
                # Auto-generated from Pydantic models
            }
        }
    }
```

### 3. Testing Improvements

1. **Add Integration Test Suite**

```python
# tests/integration/test_api_integration.py

import pytest
from moto import mock_dynamodb, mock_secretsmanager

@pytest.fixture
def api_client():
    """Create test client for API testing."""
    from app.api.admin import lambda_handler
    return LambdaTestClient(lambda_handler)

class TestOrganizationAPI:
    def test_create_organization(self, api_client, mock_auth):
        response = api_client.post(
            "/v1/admin/organizations",
            json={"name": "Test Org", "manager_id": "..."},
            headers={"Authorization": mock_auth.admin_token},
        )
        assert response.status_code == 201
        assert "id" in response.json()
    
    def test_create_organization_unauthorized(self, api_client, mock_auth):
        response = api_client.post(
            "/v1/admin/organizations",
            json={"name": "Test Org"},
            headers={"Authorization": mock_auth.user_token},
        )
        assert response.status_code == 403
```

2. **Add Load Testing**

```python
# tests/load/locustfile.py

from locust import HttpUser, task, between

class SearchUser(HttpUser):
    wait_time = between(1, 3)
    
    @task(10)
    def search_activities(self):
        self.client.get(
            "/v1/activities/search",
            headers={"x-api-key": API_KEY},
            params={"age": 5, "district": "Central"},
        )
    
    @task(1)
    def search_with_filters(self):
        self.client.get(
            "/v1/activities/search",
            headers={"x-api-key": API_KEY},
            params={
                "age": 8,
                "district": "Kowloon",
                "pricing_type": "per_class",
                "price_max": 500,
            },
        )
```

---

## AWS Expense Estimates

### Monthly Cost Breakdown

Based on typical usage patterns for a mobile app with admin console:

#### Assumptions
- **Active Users**: 10,000 monthly active users
- **API Requests**: 500,000 requests/month
- **Admin Users**: 50 concurrent
- **Data Storage**: 10 GB database, 50 GB images
- **Region**: ap-east-1 (Hong Kong)

---

### Core Services

| Service | Configuration | Estimated Monthly Cost |
|---------|--------------|----------------------|
| **Aurora Serverless v2** | 0.5-2 ACU, ~50% utilization | $70-140 |
| **RDS Proxy** | db.t3.medium equivalent | $21 |
| **Lambda** | 500K invocations, 512MB, 500ms avg | $5-10 |
| **API Gateway** | 500K requests, 0.5GB cache | $10-15 |
| **Cognito** | 10K MAU (within free tier) | $0 |
| **S3** | 50GB + 100K requests | $2-5 |
| **CloudFront** | 100GB transfer, 500K requests | $15-20 |
| **Secrets Manager** | 5 secrets | $3 |
| **KMS** | 5 keys, 10K requests | $5-10 |
| **CloudWatch** | Logs, metrics, alarms | $20-30 |
| **WAF** | 2 Web ACLs, 500K requests | $15-20 |
| **NAT Gateway** | 1 gateway, 50GB transfer | $45-60 |
| **VPC** | Endpoints, etc. | $10 |

---

### Cost Summary by Tier

| Tier | Monthly Traffic | Estimated Cost |
|------|-----------------|----------------|
| **Development** | <10K requests | $50-80 |
| **Staging** | 10K-50K requests | $100-150 |
| **Production (Low)** | 100K-500K requests | $200-350 |
| **Production (Medium)** | 500K-2M requests | $350-600 |
| **Production (High)** | 2M-10M requests | $600-1,500 |

---

### Cost Optimization Recommendations

#### High Impact (Save 30-50%)

1. **Use Aurora Serverless v2 Scaling Wisely**
   - Current: 0.5-2 ACU
   - Recommendation: Set minimum to 0 for dev/staging
   - Savings: ~$30-50/month per environment

2. **Replace NAT Gateway with VPC Endpoints**
   - Current: NAT Gateway at $45+/month
   - Alternative: VPC endpoints for S3, Secrets Manager, RDS
   - Savings: $30-40/month

```typescript
// backend/infrastructure/lib/api-stack.ts

// Add VPC endpoints to avoid NAT Gateway costs
vpc.addGatewayEndpoint("S3Endpoint", {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
  service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
});

vpc.addInterfaceEndpoint("RdsEndpoint", {
  service: ec2.InterfaceVpcEndpointAwsService.RDS,
});
```

3. **Aurora Reserved Capacity** (Save 30-40% on database)
   
   For production workloads with predictable usage, Aurora Reserved Instances provide significant savings:
   
   | Commitment | 1-Year Savings | 3-Year Savings |
   |------------|----------------|----------------|
   | No Upfront | ~30% | ~40% |
   | Partial Upfront | ~35% | ~45% |
   | All Upfront | ~40% | ~50% |
   
   **How to Purchase:**
   ```bash
   # Via AWS CLI - purchase 1-year reserved capacity
   aws rds purchase-reserved-db-instances-offering \
     --reserved-db-instances-offering-id <offering-id> \
     --db-instance-count 1 \
     --reserved-db-instance-id siutindei-prod-reserved
   
   # List available offerings for Aurora Serverless v2
   aws rds describe-reserved-db-instances-offerings \
     --product-description "aurora-postgresql" \
     --offering-type "No Upfront"
   ```
   
   **Recommendations:**
   - For production: 1-year partial upfront (best balance of savings vs flexibility)
   - For staging/dev: Keep on-demand (workloads are unpredictable)
   - Review usage patterns quarterly using AWS Cost Explorer
   - Consider Savings Plans as an alternative for multi-service discounts

4. **Use Graviton2/ARM for Lambda** (Save 20% on compute)
   - 20% lower cost, often better performance
   
```typescript
const searchFunction = lambdaFactory.create("SearchFunction", {
  // ... existing config
  architecture: lambda.Architecture.ARM_64,
});
```

#### Medium Impact (Save 10-20%)

5. **Optimize CloudWatch Logs**
   - Reduce retention to 30 days for non-critical logs
   - Use log sampling for high-volume functions

6. **Enable S3 Intelligent-Tiering**
```typescript
new s3.Bucket(this, "OrganizationImagesBucket", {
  // ... existing config
  intelligentTieringConfigurations: [{
    name: "AutoTiering",
    archiveAccessTierTime: cdk.Duration.days(90),
    deepArchiveAccessTierTime: cdk.Duration.days(180),
  }],
});
```

7. **API Gateway Response Caching**
   - Increase cache TTL where data is stable
   - Use cache invalidation sparingly

---

### Cost Monitoring Setup

```typescript
// backend/infrastructure/lib/monitoring-stack.ts

// Add cost alerts
const costAlarm = new cloudwatch.Alarm(this, "MonthlyCostAlarm", {
  metric: new cloudwatch.Metric({
    namespace: "AWS/Billing",
    metricName: "EstimatedCharges",
    dimensionsMap: {
      Currency: "USD",
    },
    statistic: "Maximum",
    period: cdk.Duration.hours(6),
  }),
  threshold: 500,  // Alert at $500
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

// SNS topic for cost alerts
const costAlertTopic = new sns.Topic(this, "CostAlertTopic");
costAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(costAlertTopic));
```

---

## Implementation Priority

### Phase 1: Critical Security (Week 1-2)
1. ✅ JWT signature validation in authorizers
2. ✅ Add SQLi WAF rule
3. ✅ Implement request size limits
4. ✅ Add security headers

### Phase 2: Performance (Week 3-4)
1. Add read replica for search traffic
2. Implement ElastiCache for query caching
3. Add provisioned concurrency for search Lambda
4. Optimize database indexes

### Phase 3: Cost Optimization (Week 5-6)
1. Replace NAT Gateway with VPC endpoints
2. Enable ARM architecture for Lambdas
3. Configure S3 Intelligent-Tiering
4. Set up cost monitoring and alerts

### Phase 4: Refactoring (Week 7-8)
1. Implement Unit of Work pattern
2. Standardize API response format
3. Add OpenAPI schema generation
4. Expand integration test coverage

---

## Conclusion

The Siu Tin Dei solution has a solid foundation with many security best practices already in place. The key areas for improvement are:

1. **Security**: JWT validation, additional WAF rules, and rate limiting improvements
2. **Performance**: Database read replicas, caching layer, and Lambda optimization
3. **Cost**: NAT Gateway replacement and reserved capacity planning
4. **Maintainability**: Standardized patterns and improved test coverage

Implementing these recommendations will result in a more secure, performant, and cost-effective solution.
