#!/usr/bin/env bash
# Writes public website build env defaults to GITHUB_OUTPUT from CDK params.
# GitHub Environment vars may override these values in workflow env blocks.
set -euo pipefail

PARAMS_FILE="${1:-backend/infrastructure/params/production.json}"

if [ -z "${GITHUB_OUTPUT:-}" ]; then
  echo 'GITHUB_OUTPUT is not set'
  exit 1
fi

python3 - "$PARAMS_FILE" <<'PY'
import json
import os
import sys
from pathlib import Path

params_path = Path(sys.argv[1])
params = json.loads(params_path.read_text(encoding="utf-8"))


def get(key: str, default: str = "") -> str:
    return str(params.get(key, default)).strip()


prod_domain = get("PublicWwwDomainName")
staging_domain = get("PublicWwwStagingDomainName")
if not prod_domain or not staging_domain:
    raise SystemExit(
        "PublicWwwDomainName and PublicWwwStagingDomainName are required "
        f"in {params_path}"
    )

outputs = {
    "production_site_origin": f"https://{prod_domain}",
    "staging_site_origin": f"https://{staging_domain}",
    "site_name": get("PublicWwwSiteName", "Siu Tin Dei"),
    "site_tagline": get(
        "PublicWwwSiteTagline",
        "Curated children's activities in Hong Kong.",
    ),
    "contact_email": get("PublicWwwContactEmail", get("AuthEmailFromAddress", "")),
}

out_path = os.environ["GITHUB_OUTPUT"]
with open(out_path, "a", encoding="utf-8") as handle:
    for key, value in outputs.items():
        handle.write(f"{key}={value}\n")
PY
