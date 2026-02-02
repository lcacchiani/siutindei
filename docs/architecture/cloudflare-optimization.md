# Cloudflare Optimization Guide

This document outlines Cloudflare optimization strategies for the Siu Tin Dei project, covering the mobile API, admin web console, and static assets.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Option A: Hybrid AWS + Cloudflare](#option-a-hybrid-aws--cloudflare)
- [Option B: Cloudflare-First Migration](#option-b-cloudflare-first-migration)
- [API Optimization](#api-optimization)
- [Admin Web Optimization](#admin-web-optimization)
- [Image Optimization](#image-optimization)
- [Security Enhancements](#security-enhancements)
- [Performance Optimizations](#performance-optimizations)
- [Cost Comparison](#cost-comparison)
- [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### Current Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Current Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Flutter Mobile ──────────► API Gateway ──────────► Lambda (Python)     │
│       │                        │                         │              │
│       │                   WAF (optional)            RDS Proxy           │
│       │                        │                         │              │
│       └──── x-api-key ─────────┘                   Aurora PostgreSQL    │
│             x-device-attestation                                        │
│                                                                         │
│  Admin Web ───────────────► CloudFront ───────────► S3 (static export)  │
│       │                        │                                        │
│       │                   WAF (us-east-1)                               │
│       │                        │                                        │
│       └──── Cognito ───────────┘                                        │
│                                                                         │
│  Organization Images ─────► S3 (public read) ──────────────────────────│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Proposed Cloudflare-Enhanced Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare-Enhanced Architecture                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ┌──────────────────────┐                        │
│                         │    Cloudflare Edge   │                        │
│                         │   ┌──────────────┐   │                        │
│  Flutter Mobile ───────►│   │ WAF + DDoS   │   │                        │
│                         │   │ Rate Limit   │   │                        │
│                         │   │ Bot Mgmt     │   │                        │
│  Admin Web ────────────►│   └──────────────┘   │                        │
│                         │          │           │                        │
│                         │   ┌──────────────┐   │                        │
│                         │   │ Cache Layer  │   │                        │
│                         │   │ Argo Routing │   │                        │
│                         │   └──────────────┘   │                        │
│                         └──────────┬───────────┘                        │
│                                    │                                    │
│              ┌─────────────────────┼─────────────────────┐              │
│              │                     │                     │              │
│              ▼                     ▼                     ▼              │
│       API Gateway           S3 / R2 / Pages       S3 (Images)          │
│              │                                          │              │
│              ▼                                          ▼              │
│        Lambda + RDS                           Cloudflare Images        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Option A: Hybrid AWS + Cloudflare

Keep AWS infrastructure, add Cloudflare as edge layer. **Recommended for incremental adoption.**

### 1. DNS Setup

```hcl
# Example Cloudflare DNS configuration (Terraform)
resource "cloudflare_zone" "main" {
  zone = "siutindei.lx-software.com"
}

# API subdomain - proxied through Cloudflare
resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.main.id
  name    = "api"
  value   = "your-api-gateway-id.execute-api.region.amazonaws.com"
  type    = "CNAME"
  proxied = true  # Enable Cloudflare proxy
}

# Admin web - proxied through Cloudflare
resource "cloudflare_record" "admin" {
  zone_id = cloudflare_zone.main.id
  name    = "admin"
  value   = "your-cloudfront-distribution.cloudfront.net"
  type    = "CNAME"
  proxied = true
}
```

### 2. API Gateway Configuration

When proxying API Gateway through Cloudflare, update your CDK stack:

```typescript
// backend/infrastructure/lib/api-stack.ts

// Add custom domain to API Gateway
const apiDomainName = new apigateway.DomainName(this, "ApiDomainName", {
  domainName: "api.siutindei.lx-software.com",
  certificate: apiCertificate,  // ACM certificate in same region
  endpointType: apigateway.EndpointType.REGIONAL,  // Required for Cloudflare
});

apiDomainName.addBasePathMapping(api, {
  basePath: "",
});
```

### 3. Origin Rules

Configure Cloudflare to pass required headers to API Gateway:

```json
// Cloudflare Transform Rules (via API or Dashboard)
{
  "expression": "(http.host eq \"api.siutindei.lx-software.com\")",
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "Host": {
        "operation": "set",
        "value": "your-api-gateway-id.execute-api.region.amazonaws.com"
      }
    }
  }
}
```

---

## Option B: Cloudflare-First Migration

Replace AWS services with Cloudflare equivalents where beneficial.

### Admin Web: Cloudflare Pages

Replace S3 + CloudFront + WAF with Cloudflare Pages:

**Benefits:**
- Simpler deployment (direct Git integration)
- Automatic preview deployments for PRs
- Built-in DDoS protection and WAF
- Global CDN included
- Zero-config HTTPS

**Migration Steps:**

1. **Connect Repository to Cloudflare Pages:**

```yaml
# .github/workflows/deploy-admin-web-cloudflare.yml
name: Deploy Admin Web to Cloudflare Pages

on:
  push:
    branches: [main]
    paths:
      - 'apps/admin_web/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/admin_web/package-lock.json
      
      - name: Install dependencies
        run: npm ci
        working-directory: apps/admin_web
      
      - name: Build
        run: npm run build
        working-directory: apps/admin_web
        env:
          NEXT_PUBLIC_API_URL: ${{ vars.API_URL }}
          NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${{ vars.COGNITO_USER_POOL_ID }}
          NEXT_PUBLIC_COGNITO_CLIENT_ID: ${{ vars.COGNITO_CLIENT_ID }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: siutindei-admin
          directory: apps/admin_web/out
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

2. **Update Next.js Config for Cloudflare:**

```javascript
// apps/admin_web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    // Or use Cloudflare Image Resizing
    loader: 'custom',
    loaderFile: './src/lib/cloudflare-image-loader.ts',
  },
};

module.exports = nextConfig;
```

3. **Create Custom Image Loader:**

```typescript
// apps/admin_web/src/lib/cloudflare-image-loader.ts
interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export default function cloudflareLoader({ src, width, quality }: ImageLoaderParams): string {
  const params = [`width=${width}`, `quality=${quality || 75}`, 'format=auto'];
  
  // Use Cloudflare Image Resizing
  if (src.startsWith('/')) {
    return `/cdn-cgi/image/${params.join(',')}${src}`;
  }
  
  // External images
  return `/cdn-cgi/image/${params.join(',')}/` + encodeURIComponent(src);
}
```

### Organization Images: Cloudflare R2 + Images

Replace S3 with Cloudflare R2 for organization images:

**Benefits:**
- Zero egress fees (significant savings for image-heavy apps)
- Automatic image optimization
- S3-compatible API (minimal code changes)
- Built-in CDN

**CDK Changes (keep S3 as fallback):**

```typescript
// Environment variable to toggle storage backend
const storageBackend = process.env.STORAGE_BACKEND || 's3';

// Lambda environment
const adminFunction = createPythonFunction("SiutindeiAdminFunction", {
  // ...existing config...
  environment: {
    // ...existing vars...
    STORAGE_BACKEND: storageBackend,
    CLOUDFLARE_R2_ENDPOINT: process.env.CLOUDFLARE_R2_ENDPOINT || '',
    CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  },
});
```

**Python Storage Abstraction:**

```python
# backend/src/app/storage/base.py
from abc import ABC, abstractmethod
from typing import Optional
import boto3
from botocore.config import Config

class StorageBackend(ABC):
    @abstractmethod
    def upload(self, key: str, data: bytes, content_type: str) -> str:
        pass
    
    @abstractmethod
    def delete(self, key: str) -> None:
        pass
    
    @abstractmethod
    def get_public_url(self, key: str) -> str:
        pass


class S3Backend(StorageBackend):
    def __init__(self, bucket: str, base_url: str):
        self.bucket = bucket
        self.base_url = base_url
        self.client = boto3.client('s3')
    
    def upload(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return self.get_public_url(key)
    
    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)
    
    def get_public_url(self, key: str) -> str:
        return f"{self.base_url}/{key}"


class CloudflareR2Backend(StorageBackend):
    def __init__(
        self,
        endpoint: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_url: str,
    ):
        self.bucket = bucket
        self.public_url = public_url
        self.client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version='s3v4'),
        )
    
    def upload(self, key: str, data: bytes, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return self.get_public_url(key)
    
    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)
    
    def get_public_url(self, key: str) -> str:
        # Cloudflare Images URL with automatic optimization
        return f"{self.public_url}/{key}"


def get_storage_backend() -> StorageBackend:
    import os
    backend = os.environ.get('STORAGE_BACKEND', 's3')
    
    if backend == 'r2':
        return CloudflareR2Backend(
            endpoint=os.environ['CLOUDFLARE_R2_ENDPOINT'],
            access_key_id=os.environ['CLOUDFLARE_R2_ACCESS_KEY_ID'],
            secret_access_key=os.environ['CLOUDFLARE_R2_SECRET_ACCESS_KEY'],
            bucket=os.environ['CLOUDFLARE_R2_BUCKET'],
            public_url=os.environ.get('CLOUDFLARE_R2_PUBLIC_URL', ''),
        )
    
    return S3Backend(
        bucket=os.environ['ORGANIZATION_PICTURES_BUCKET'],
        base_url=os.environ['ORGANIZATION_PICTURES_BASE_URL'],
    )
```

---

## API Optimization

### Cache Rules for Activity Search

Create Cloudflare Cache Rules for the search endpoint:

```javascript
// Cloudflare Cache Rules (via API or Dashboard)

// Rule 1: Cache search results at edge
{
  "expression": "(http.request.uri.path eq \"/v1/activities/search\")",
  "action": "set_cache_settings",
  "action_parameters": {
    "edge_ttl": {
      "mode": "override_origin",
      "default": 300  // 5 minutes, matches API Gateway cache
    },
    "browser_ttl": {
      "mode": "override_origin", 
      "default": 60  // 1 minute browser cache
    },
    "cache_key": {
      "custom_key": {
        "query_string": {
          "include": [
            "age", "district", "pricing_type", "price_min", "price_max",
            "schedule_type", "day_of_week_utc", "day_of_month",
            "start_minutes_utc", "end_minutes_utc", "start_at_utc",
            "end_at_utc", "language", "limit", "cursor"
          ]
        },
        "header": {
          "include": ["x-api-key"]  // Different cache per API key
        }
      }
    }
  }
}

// Rule 2: Bypass cache for admin routes
{
  "expression": "(http.request.uri.path contains \"/v1/admin\")",
  "action": "set_cache_settings",
  "action_parameters": {
    "cache": false
  }
}
```

### Cache Headers from Lambda

Update Lambda responses to include proper cache headers:

```python
# backend/src/app/utils/responses.py

from typing import Any, Dict, Optional

def api_response(
    body: Any,
    status_code: int = 200,
    cache_max_age: Optional[int] = None,
    cache_s_maxage: Optional[int] = None,
    stale_while_revalidate: Optional[int] = None,
) -> Dict[str, Any]:
    """Create API Gateway response with optional caching headers."""
    headers = {
        "Content-Type": "application/json",
    }
    
    # Build Cache-Control header
    cache_directives = []
    
    if cache_max_age is not None:
        cache_directives.append(f"max-age={cache_max_age}")
    
    if cache_s_maxage is not None:
        cache_directives.append(f"s-maxage={cache_s_maxage}")
    
    if stale_while_revalidate is not None:
        cache_directives.append(f"stale-while-revalidate={stale_while_revalidate}")
    
    if cache_directives:
        headers["Cache-Control"] = ", ".join(cache_directives)
    else:
        # Default: no caching for non-specified endpoints
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    
    import json
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body),
    }


def search_response(body: Any) -> Dict[str, Any]:
    """Response for search endpoint with caching enabled."""
    return api_response(
        body,
        cache_max_age=60,           # Browser: 1 minute
        cache_s_maxage=300,         # CDN: 5 minutes
        stale_while_revalidate=60,  # Serve stale while revalidating
    )


def admin_response(body: Any, status_code: int = 200) -> Dict[str, Any]:
    """Response for admin endpoints with no caching."""
    return api_response(body, status_code)
```

### Tiered Cache Configuration

Enable Tiered Cache to reduce origin requests:

```hcl
# Terraform Cloudflare configuration
resource "cloudflare_tiered_cache" "api" {
  zone_id    = cloudflare_zone.main.id
  cache_type = "smart"  # Argo Tiered Cache
}
```

---

## Admin Web Optimization

### Page Rules and Cache Configuration

```hcl
# Static assets - aggressive caching
resource "cloudflare_page_rule" "admin_static" {
  zone_id  = cloudflare_zone.main.id
  target   = "admin.siutindei.lx-software.com/_next/static/*"
  priority = 1
  
  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 31536000  # 1 year
    browser_cache_ttl = 31536000
  }
}

# HTML pages - shorter cache with revalidation
resource "cloudflare_page_rule" "admin_pages" {
  zone_id  = cloudflare_zone.main.id
  target   = "admin.siutindei.lx-software.com/*"
  priority = 2
  
  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 300  # 5 minutes
    browser_cache_ttl = 0  # Always revalidate
  }
}
```

### Early Hints (103)

Enable Early Hints to preload critical resources:

```hcl
resource "cloudflare_zone_settings_override" "admin" {
  zone_id = cloudflare_zone.main.id
  
  settings {
    early_hints = "on"
  }
}
```

### HTTP/3 (QUIC)

Enable HTTP/3 for faster connections on mobile:

```hcl
resource "cloudflare_zone_settings_override" "zone" {
  zone_id = cloudflare_zone.main.id
  
  settings {
    http3 = "on"
  }
}
```

---

## Image Optimization

### Cloudflare Image Resizing

Use Cloudflare's image resizing for organization pictures:

```typescript
// Frontend image URL transformation
function getOptimizedImageUrl(
  originalUrl: string,
  options: { width?: number; height?: number; fit?: string; quality?: number }
): string {
  const { width, height, fit = 'cover', quality = 80 } = options;
  
  const params = [
    width && `width=${width}`,
    height && `height=${height}`,
    `fit=${fit}`,
    `quality=${quality}`,
    'format=auto',  // Automatic WebP/AVIF
  ].filter(Boolean).join(',');
  
  // Cloudflare Image Resizing URL format
  return `https://siutindei.lx-software.com/cdn-cgi/image/${params}/${encodeURIComponent(originalUrl)}`;
}
```

### Polish and Mirage

Enable automatic image optimization:

```hcl
resource "cloudflare_zone_settings_override" "images" {
  zone_id = cloudflare_zone.main.id
  
  settings {
    # Compress images (Pro+ plan)
    polish = "lossy"
    
    # Lazy load images on slow connections (Pro+ plan)
    mirage = "on"
  }
}
```

---

## Security Enhancements

### WAF Rules

Cloudflare WAF can replace or supplement AWS WAF:

```hcl
# Cloudflare WAF Managed Rules
resource "cloudflare_ruleset" "waf" {
  zone_id     = cloudflare_zone.main.id
  name        = "WAF Ruleset"
  description = "WAF rules for Siu Tin Dei"
  kind        = "zone"
  phase       = "http_request_firewall_managed"
  
  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"  # OWASP Core Ruleset
    }
    expression  = "true"
    description = "Execute OWASP Core Ruleset"
    enabled     = true
  }
  
  rules {
    action = "execute"
    action_parameters {
      id = "c2e184081120413c86c3ab7e14069605"  # Cloudflare Managed Ruleset
    }
    expression  = "true"
    description = "Execute Cloudflare Managed Ruleset"
    enabled     = true
  }
}
```

### Rate Limiting

Replace or supplement API Gateway rate limiting:

```hcl
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = cloudflare_zone.main.id
  name        = "Rate Limiting"
  description = "Rate limiting rules"
  kind        = "zone"
  phase       = "http_ratelimit"
  
  # Search endpoint: 100 requests per minute per IP
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 60
    }
    expression  = "(http.request.uri.path eq \"/v1/activities/search\")"
    description = "Rate limit search endpoint"
    enabled     = true
  }
  
  # Admin endpoints: 30 requests per minute per user
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["cf.colo.id", "http.request.headers[\"authorization\"]"]
      period              = 60
      requests_per_period = 30
      mitigation_timeout  = 60
    }
    expression  = "(http.request.uri.path contains \"/v1/admin\")"
    description = "Rate limit admin endpoints"
    enabled     = true
  }
}
```

### Bot Management

Protect against malicious bots while allowing legitimate mobile apps:

```hcl
resource "cloudflare_ruleset" "bot_management" {
  zone_id     = cloudflare_zone.main.id
  name        = "Bot Management"
  description = "Bot management rules"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  
  # Block definitely automated traffic
  rules {
    action      = "block"
    expression  = "(cf.bot_management.score lt 10) and not (http.request.headers[\"x-device-attestation\"] ne \"\")"
    description = "Block likely bots without attestation"
    enabled     = true
  }
  
  # Challenge suspicious traffic
  rules {
    action      = "managed_challenge"
    expression  = "(cf.bot_management.score lt 30) and not (http.request.headers[\"x-device-attestation\"] ne \"\")"
    description = "Challenge suspicious traffic"
    enabled     = true
  }
}
```

### Security Headers

Add security headers at the edge:

```hcl
resource "cloudflare_ruleset" "security_headers" {
  zone_id     = cloudflare_zone.main.id
  name        = "Security Headers"
  description = "Add security headers"
  kind        = "zone"
  phase       = "http_response_headers_transform"
  
  rules {
    action = "rewrite"
    action_parameters {
      headers {
        name      = "Strict-Transport-Security"
        operation = "set"
        value     = "max-age=31536000; includeSubDomains; preload"
      }
      headers {
        name      = "X-Content-Type-Options"
        operation = "set"
        value     = "nosniff"
      }
      headers {
        name      = "X-Frame-Options"
        operation = "set"
        value     = "DENY"
      }
      headers {
        name      = "Referrer-Policy"
        operation = "set"
        value     = "strict-origin-when-cross-origin"
      }
      headers {
        name      = "Permissions-Policy"
        operation = "set"
        value     = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
      }
    }
    expression  = "(http.host eq \"admin.siutindei.lx-software.com\")"
    description = "Add security headers to admin web"
    enabled     = true
  }
}
```

---

## Performance Optimizations

### Argo Smart Routing

Enable Argo for faster API responses:

```hcl
resource "cloudflare_argo" "api" {
  zone_id        = cloudflare_zone.main.id
  tiered_caching = "on"
  smart_routing  = "on"  # Routes around network congestion
}
```

### Prefetch/Preconnect Injection

Automatically inject resource hints:

```javascript
// Cloudflare Worker for prefetch injection (optional)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const response = await fetch(request);
  
  if (response.headers.get('content-type')?.includes('text/html')) {
    const html = await response.text();
    
    const hints = `
      <link rel="preconnect" href="https://api.siutindei.lx-software.com">
      <link rel="dns-prefetch" href="https://api.siutindei.lx-software.com">
    `;
    
    const modifiedHtml = html.replace('</head>', `${hints}</head>`);
    
    return new Response(modifiedHtml, {
      headers: {
        ...Object.fromEntries(response.headers),
        'Link': '<https://api.siutindei.lx-software.com>; rel=preconnect',
      },
    });
  }
  
  return response;
}
```

### Load Balancing (Optional)

If deploying to multiple AWS regions:

```hcl
resource "cloudflare_load_balancer" "api" {
  zone_id          = cloudflare_zone.main.id
  name             = "api.siutindei.lx-software.com"
  fallback_pool_id = cloudflare_load_balancer_pool.api_primary.id
  default_pool_ids = [cloudflare_load_balancer_pool.api_primary.id]
  
  session_affinity = "cookie"
  
  adaptive_routing {
    failover_across_pools = true
  }
}

resource "cloudflare_load_balancer_pool" "api_primary" {
  name = "api-primary"
  
  origins {
    name    = "api-gateway-us-east-1"
    address = "api-us-east-1.execute-api.amazonaws.com"
    enabled = true
    
    header {
      header = "Host"
      values = ["api-us-east-1.execute-api.amazonaws.com"]
    }
  }
  
  monitor = cloudflare_load_balancer_monitor.api.id
}

resource "cloudflare_load_balancer_monitor" "api" {
  type           = "https"
  expected_body  = "ok"
  expected_codes = "200"
  method         = "GET"
  path           = "/health"
  interval       = 60
  timeout        = 5
  retries        = 2
}
```

---

## Cost Comparison

### Current AWS Costs (Estimated Monthly)

| Service | Cost |
|---------|------|
| CloudFront | $50-150 (based on traffic) |
| S3 (storage + requests) | $5-20 |
| AWS WAF | $5+ per WebACL + $0.60/1M requests |
| API Gateway | $3.50/1M requests |
| Data Transfer | Variable |
| **Total** | **$100-300+** |

### Cloudflare Costs (Estimated Monthly)

| Plan | Cost | Features |
|------|------|----------|
| **Free** | $0 | Basic CDN, DDoS, WAF rules |
| **Pro** | $20/zone | Full WAF, Polish, Mirage |
| **Business** | $200/zone | Custom WAF rules, China network |
| **Argo** | $5/zone + $0.10/GB | Smart routing, Tiered Cache |
| **R2** | $0.015/GB stored, $0 egress | S3-compatible storage |
| **Pages** | Free | Static site hosting |

### Recommended Configuration

For most use cases, **Cloudflare Pro ($20/month) + Argo (~$10/month)** provides:
- Full WAF with OWASP rules
- Image optimization (Polish + Mirage)
- Smart routing for API calls
- Tiered caching
- Bot management
- HTTP/3

**Estimated savings: 40-60%** compared to full AWS stack.

---

## Implementation Roadmap

### Phase 1: DNS + CDN (Week 1)

1. Create Cloudflare account and add zone
2. Configure DNS records (proxied)
3. Enable HTTPS and configure SSL/TLS settings
4. Test existing functionality through Cloudflare

### Phase 2: Caching + Performance (Week 2)

1. Configure cache rules for search API
2. Enable Argo Smart Routing
3. Set up Tiered Cache
4. Enable HTTP/3

### Phase 3: Security Hardening (Week 3)

1. Configure WAF rules
2. Set up rate limiting
3. Add security headers
4. Enable Bot Management (if needed)

### Phase 4: Admin Web Migration (Week 4, Optional)

1. Set up Cloudflare Pages project
2. Update CI/CD workflow
3. Test preview deployments
4. Switch production traffic

### Phase 5: Image Optimization (Week 5, Optional)

1. Enable Image Resizing
2. Consider R2 migration for zero-egress benefits
3. Update frontend image loading
4. Monitor performance improvements

---

## Monitoring and Analytics

### Cloudflare Analytics

Access via Cloudflare Dashboard:
- **Traffic Analytics**: Requests, bandwidth, cache hit ratio
- **Security Analytics**: Blocked threats, WAF events, bot traffic
- **Performance Analytics**: Origin response time, cache performance

### GraphQL API

Query Cloudflare analytics programmatically:

```graphql
query {
  viewer {
    zones(filter: { zoneTag: "YOUR_ZONE_ID" }) {
      httpRequests1dGroups(
        orderBy: [date_ASC]
        limit: 30
        filter: { date_gt: "2024-01-01" }
      ) {
        dimensions {
          date
        }
        sum {
          requests
          cachedRequests
          bytes
          cachedBytes
        }
      }
    }
  }
}
```

---

## Conclusion

Cloudflare provides significant benefits for the Siu Tin Dei project:

1. **Performance**: Edge caching, smart routing, HTTP/3
2. **Security**: Enterprise-grade WAF, DDoS protection, bot management
3. **Cost**: Potential 40-60% savings vs. AWS-only stack
4. **Simplicity**: Managed services reduce operational overhead

**Recommended starting point**: 
- Hybrid approach (Option A) with Cloudflare Pro + Argo
- Migrate admin web to Cloudflare Pages for simpler deployments
- Keep API Gateway + Lambda backend (proven, well-integrated)

This approach provides immediate benefits with minimal disruption to existing infrastructure.
