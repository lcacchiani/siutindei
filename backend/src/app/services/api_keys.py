"""Partner API key generation and hashing.

Keys have the form ``stk_<43 urlsafe chars>``. Only the SHA-256 hash is
persisted; the plaintext is shown once at creation time.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import NamedTuple

API_KEY_TOKEN_PREFIX = "stk_"
API_KEY_DISPLAY_PREFIX_LENGTH = 12
_SECRET_BYTES = 32  # 32 bytes -> 43 urlsafe base64 characters


class GeneratedApiKey(NamedTuple):
    """A freshly generated API key and its stored representations."""

    plaintext: str
    prefix: str
    key_hash: str


def hash_api_key(plaintext: str) -> str:
    """Return the SHA-256 hex digest of a plaintext API key."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def generate_api_key() -> GeneratedApiKey:
    """Generate a new API key using a cryptographically secure source."""
    plaintext = API_KEY_TOKEN_PREFIX + secrets.token_urlsafe(_SECRET_BYTES)
    return GeneratedApiKey(
        plaintext=plaintext,
        prefix=plaintext[:API_KEY_DISPLAY_PREFIX_LENGTH],
        key_hash=hash_api_key(plaintext),
    )


def looks_like_api_key(value: str) -> bool:
    """Cheap format check before hitting the database."""
    return (
        value.startswith(API_KEY_TOKEN_PREFIX)
        and API_KEY_DISPLAY_PREFIX_LENGTH <= len(value) <= 128
    )
