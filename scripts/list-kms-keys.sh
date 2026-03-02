#!/usr/bin/env bash
set -euo pipefail

# Lists the KMS custom key IDs created by the CDK stacks.
# Queries CloudFormation for AWS::KMS::Key resources and prints
# their logical IDs alongside the physical KMS Key IDs.
#
# Usage:
#   ./scripts/list-kms-keys.sh
#   AWS_REGION=ap-southeast-1 ./scripts/list-kms-keys.sh

API_STACK="${API_STACK_NAME:-lxsoftware-siutindei}"
WAF_STACK="${WAF_STACK_NAME:-lxsoftware-siutindei-waf}"
WAF_REGION="${WAF_REGION:-us-east-1}"
REGION="${AWS_REGION:-${CDK_DEFAULT_REGION:-}}"

REGION_FLAG=()
if [ -n "$REGION" ]; then
  REGION_FLAG=(--region "$REGION")
fi

list_kms_keys() {
  local stack="$1"
  shift
  local extra_flags=("$@")

  local output
  output="$(aws cloudformation describe-stack-resources \
    --stack-name "$stack" \
    "${extra_flags[@]}" \
    --query "StackResources[?ResourceType=='AWS::KMS::Key'].[LogicalResourceId,PhysicalResourceId]" \
    --output text 2>&1)" || {
    echo "  (could not query stack \"$stack\": $output)" >&2
    return 0
  }

  if [ -z "$output" ]; then
    echo "  (no KMS keys found)"
    return 0
  fi

  while IFS=$'\t' read -r logical physical; do
    printf "  %-50s %s\n" "$logical" "$physical"
  done <<< "$output"
}

echo "============================================================"
echo " KMS Custom Key IDs"
echo "============================================================"
echo ""
printf "%-52s %s\n" "  LOGICAL ID" "KEY ID"
printf "%-52s %s\n" "  ----------" "------"

echo ""
echo "--- $API_STACK ---"
list_kms_keys "$API_STACK" "${REGION_FLAG[@]}"

echo ""
echo "--- $WAF_STACK (region: $WAF_REGION) ---"
list_kms_keys "$WAF_STACK" --region "$WAF_REGION"

echo ""
echo "============================================================"
