#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Upsert Cloudflare CNAME records for the public website CloudFront aliases.
#
# Required env:
#   CLOUDFLARE_API_TOKEN
#
# Optional env:
#   CLOUDFLARE_ACCOUNT_ID   — limits zone lookup to this account
#   CLOUDFLARE_ZONE_ID      — skip zone discovery when set
#   CLOUDFLARE_ZONE_NAME    — zone apex (default: lx-software.com)
#   CLOUDFLARE_DNS_PROXIED  — true|false (default: false, matches other LX DNS)
#   PUBLIC_WWW_STACK_NAME   — default lxsoftware-siutindei-public-www
#   CDK_PARAMS_FILE         — default backend/infrastructure/params/production.json
#   AWS_REGION              — CloudFormation region for stack outputs
#   PUBLIC_WWW_PRODUCTION_CF_DOMAIN — override production CloudFront domain
#   PUBLIC_WWW_STAGING_CF_DOMAIN    — override staging CloudFront domain
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
STACK_NAME="${PUBLIC_WWW_STACK_NAME:-lxsoftware-siutindei-public-www}"
PARAMS_FILE="${CDK_PARAMS_FILE:-$ROOT_DIR/backend/infrastructure/params/production.json}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-lx-software.com}"
PROXIED="${CLOUDFLARE_DNS_PROXIED:-false}"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo 'CLOUDFLARE_API_TOKEN is required'
  exit 1
fi

if [ ! -f "$PARAMS_FILE" ]; then
  echo "CDK params file not found: $PARAMS_FILE"
  exit 1
fi

PRODUCTION_HOST="$(python3 -c "import json; from pathlib import Path; p=json.loads(Path('$PARAMS_FILE').read_text(encoding='utf-8')); print(str(p.get('PublicWwwDomainName','')).strip())")"
STAGING_HOST="$(python3 -c "import json; from pathlib import Path; p=json.loads(Path('$PARAMS_FILE').read_text(encoding='utf-8')); print(str(p.get('PublicWwwStagingDomainName','')).strip())")"

if [ -z "$PRODUCTION_HOST" ] || [ -z "$STAGING_HOST" ]; then
  echo 'PublicWwwDomainName and PublicWwwStagingDomainName are required in params file'
  exit 1
fi

require_stack_output() {
  local output_key="$1"
  local query="Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue"
  local value
  value="$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "$query" \
    --output text 2>/dev/null || true)"
  if [ -z "$value" ] || [ "$value" = "None" ]; then
    return 1
  fi
  echo "$value"
}

PRODUCTION_TARGET="${PUBLIC_WWW_PRODUCTION_CF_DOMAIN:-}"
STAGING_TARGET="${PUBLIC_WWW_STAGING_CF_DOMAIN:-}"

if [ -z "$PRODUCTION_TARGET" ]; then
  PRODUCTION_TARGET="$(require_stack_output PublicWwwDistributionDomain || true)"
fi
if [ -z "$STAGING_TARGET" ]; then
  STAGING_TARGET="$(require_stack_output PublicWwwStagingDistributionDomain || true)"
fi

if [ -z "$PRODUCTION_TARGET" ] || [ -z "$STAGING_TARGET" ]; then
  echo "CloudFront distribution domains are required."
  echo "Deploy $STACK_NAME first or set PUBLIC_WWW_PRODUCTION_CF_DOMAIN and"
  echo "PUBLIC_WWW_STAGING_CF_DOMAIN."
  exit 1
fi

export PRODUCTION_HOST STAGING_HOST PRODUCTION_TARGET STAGING_TARGET
export ZONE_NAME PROXIED
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
export CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cloudflare.com/client/v4"
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
ZONE_NAME = os.environ["ZONE_NAME"]
ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID", "").strip()
PROXIED = os.environ.get("PROXIED", "false").lower() in {
    "1",
    "true",
    "yes",
}


def request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{API}{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Cloudflare API {method} {path} failed ({exc.code}): {detail}") from exc

    if not payload.get("success"):
        raise SystemExit(f"Cloudflare API error on {path}: {payload.get('errors')}")
    return payload


def resolve_zone_id() -> str:
    if ZONE_ID:
        return ZONE_ID
    query = urllib.parse.urlencode({"name": ZONE_NAME, "status": "active"})
    if ACCOUNT_ID:
        query += "&" + urllib.parse.urlencode({"account.id": ACCOUNT_ID})
    payload = request("GET", f"/zones?{query}")
    zones = payload.get("result") or []
    if not zones:
        raise SystemExit(f"No active Cloudflare zone named '{ZONE_NAME}'")
    if len(zones) > 1:
        raise SystemExit(f"Multiple zones named '{ZONE_NAME}'; set CLOUDFLARE_ZONE_ID")
    return zones[0]["id"]


def find_record(zone_id: str, fqdn: str) -> dict | None:
    query = urllib.parse.urlencode({"type": "CNAME", "name": fqdn})
    payload = request("GET", f"/zones/{zone_id}/dns_records?{query}")
    records = payload.get("result") or []
    return records[0] if records else None


def upsert_cname(zone_id: str, fqdn: str, target: str) -> None:
    target = target.rstrip(".")
    existing = find_record(zone_id, fqdn)
    body = {
        "type": "CNAME",
        "name": fqdn,
        "content": target,
        "ttl": 1,
        "proxied": PROXIED,
        "comment": "siutindei public website (managed by sync-public-www-cloudflare-dns.sh)",
    }
    if existing:
        record_id = existing["id"]
        if (
            existing.get("content", "").rstrip(".") == target
            and bool(existing.get("proxied")) == PROXIED
            and existing.get("type") == "CNAME"
        ):
            print(f"unchanged: {fqdn} -> {target} (proxied={PROXIED})")
            return
        request("PATCH", f"/zones/{zone_id}/dns_records/{record_id}", body)
        print(f"updated:  {fqdn} -> {target} (proxied={PROXIED})")
        return
    request("POST", f"/zones/{zone_id}/dns_records", body)
    print(f"created:  {fqdn} -> {target} (proxied={PROXIED})")


zone_id = resolve_zone_id()
print(f"zone: {ZONE_NAME} ({zone_id})")

records = [
    (os.environ["PRODUCTION_HOST"], os.environ["PRODUCTION_TARGET"]),
    (os.environ["STAGING_HOST"], os.environ["STAGING_TARGET"]),
]

for host, target in records:
    upsert_cname(zone_id, host, target)

print("Public website Cloudflare DNS sync complete.")
PY
