"""Tests for partner API key generation and hashing."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from app.services.api_keys import (  # noqa: E402
    DISPLAY_PREFIX_LENGTH,
    PARTNER_KEY_PREFIX,
    generate_api_key,
    hash_api_key,
    looks_like_api_key,
)


def test_generate_api_key_format() -> None:
    """Generated keys use the stk_ prefix and urlsafe characters."""
    generated = generate_api_key()
    assert generated.plaintext.startswith(PARTNER_KEY_PREFIX)
    assert len(generated.plaintext) > 40


def test_generate_api_key_prefix_and_hash_match_plaintext() -> None:
    """Prefix and hash are derived from the plaintext."""
    generated = generate_api_key()
    assert generated.prefix == generated.plaintext[:DISPLAY_PREFIX_LENGTH]
    expected_hash = hashlib.sha256(generated.plaintext.encode("utf-8")).hexdigest()
    assert generated.key_hash == expected_hash


def test_generate_api_key_is_unique() -> None:
    """Two generated keys never collide."""
    first = generate_api_key()
    second = generate_api_key()
    assert first.plaintext != second.plaintext
    assert first.key_hash != second.key_hash


def test_hash_api_key_is_deterministic() -> None:
    """Hashing the same plaintext yields the same digest."""
    assert hash_api_key("stk_example") == hash_api_key("stk_example")


def test_looks_like_api_key_accepts_valid_format() -> None:
    """Well-formed keys pass the cheap format check."""
    assert looks_like_api_key(generate_api_key().plaintext)


def test_looks_like_api_key_rejects_bad_values() -> None:
    """Missing prefix, too-short, and oversized keys are rejected."""
    assert not looks_like_api_key("")
    assert not looks_like_api_key("not-a-key")
    assert not looks_like_api_key("stk_")
    assert not looks_like_api_key(PARTNER_KEY_PREFIX + "x" * 200)
