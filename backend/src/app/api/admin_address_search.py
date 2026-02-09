"""Address search proxy for admin/user endpoints."""

from __future__ import annotations

import json
import os
from typing import Any, Mapping
from urllib.parse import urlencode

from app.api.admin_request import _query_param
from app.api.admin_validators import MAX_ADDRESS_LENGTH
from app.exceptions import ValidationError
from app.services.aws_proxy import AwsProxyError, http_invoke
from app.utils import json_response
from app.utils.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
MIN_QUERY_LENGTH = 3
DEFAULT_LIMIT = 5
MAX_LIMIT = 10


def _handle_address_search(event: Mapping[str, Any]) -> dict[str, Any]:
    """Proxy address search to Nominatim."""
    query = (_query_param(event, "q") or "").strip()
    if len(query) < MIN_QUERY_LENGTH:
        raise ValidationError(
            "q must be at least 3 characters",
            field="q",
        )
    if len(query) > MAX_ADDRESS_LENGTH:
        raise ValidationError(
            f"q must be <= {MAX_ADDRESS_LENGTH} characters",
            field="q",
        )

    limit = _parse_limit(_query_param(event, "limit"))
    country_codes = (_query_param(event, "countrycodes") or "").strip()

    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": "1",
        "limit": str(limit),
        "dedupe": "1",
    }
    if country_codes:
        params["countrycodes"] = country_codes

    url = f"{NOMINATIM_SEARCH_URL}?{urlencode(params)}"
    headers = _get_nominatim_headers(event)
    if headers is None:
        logger.error("Nominatim user agent is not configured")
        return json_response(
            500,
            {"error": "Address lookup is not configured"},
            event=event,
        )

    try:
        result = http_invoke("GET", url, headers=headers, timeout=10)
    except AwsProxyError as exc:
        logger.warning("Address search proxy error: %s", exc.code)
        return json_response(
            502,
            {"error": "Address lookup failed", "detail": exc.code},
            event=event,
        )

    status = int(result.get("status") or 0)
    body = result.get("body") or ""
    if status != 200:
        logger.warning("Address search failed with status %s", status)
        return json_response(
            502,
            {"error": "Address lookup failed", "detail": f"status {status}"},
            event=event,
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        logger.warning("Address search returned invalid JSON")
        return json_response(
            502,
            {"error": "Address lookup failed", "detail": "invalid JSON"},
            event=event,
        )

    if not isinstance(payload, list):
        logger.warning("Address search response was not a list")
        return json_response(
            502,
            {"error": "Address lookup failed", "detail": "invalid response"},
            event=event,
        )

    return json_response(200, {"items": payload[:limit]}, event=event)


def _parse_limit(value: str | None) -> int:
    if value is None or value == "":
        return DEFAULT_LIMIT
    try:
        parsed = int(value)
    except (ValueError, TypeError) as exc:
        raise ValidationError(
            "limit must be an integer",
            field="limit",
        ) from exc
    if parsed < 1 or parsed > MAX_LIMIT:
        raise ValidationError(
            f"limit must be between 1 and {MAX_LIMIT}",
            field="limit",
        )
    return parsed


def _get_header(event: Mapping[str, Any], name: str) -> str:
    headers = event.get("headers") or {}
    for key, value in headers.items():
        if key.lower() == name.lower():
            return str(value)
    return ""


def _get_nominatim_headers(event: Mapping[str, Any]) -> dict[str, str] | None:
    user_agent = os.getenv("NOMINATIM_USER_AGENT", "").strip()
    referer = os.getenv("NOMINATIM_REFERER", "").strip()

    if not user_agent:
        support_email = os.getenv("SUPPORT_EMAIL", "").strip()
        origin = _get_header(event, "origin")
        host = _get_header(event, "host")
        contact = support_email or origin or host
        if contact:
            user_agent = f"SiuTinDei/1.0 ({contact})"
        else:
            return None

    if not referer:
        referer = _get_header(event, "origin") or _get_header(event, "referer")

    headers = {
        "Accept": "application/json",
        "User-Agent": user_agent,
    }
    if referer:
        headers["Referer"] = referer
    return headers
