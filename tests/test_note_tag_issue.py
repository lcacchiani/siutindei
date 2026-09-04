"""Tests for auto-filed NOTE / SECURITY NOTE issue matching."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = (
    Path(__file__).resolve().parents[1] / "scripts" / "ci" / "note_tag_issue.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location("note_tag_issue", _SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


note_tag_issue = _load_module()


@pytest.mark.parametrize(
    ("title", "body"),
    [
        (
            "NOTE: Cognito VPC endpoint not supported with ManagedLogin",
            "Found tag in `backend/infrastructure/lib/api-stack.ts` line 197:",
        ),
        (
            "SECURITY NOTE: Public organization images bucket",
            "Found tag in `backend/infrastructure/lib/api-stack.ts` line 924:",
        ),
        (
            "NOTE: next-env.d.ts should not be edited",
            "Found tag in `apps/admin_web/next-env.d.ts` line 5:",
        ),
    ],
)
def test_matches_auto_filed_note_issues(title: str, body: str) -> None:
    assert note_tag_issue.is_auto_filed_note_issue(title, body) is True


@pytest.mark.parametrize(
    ("title", "body"),
    [
        (
            "TODO: Replace with area-based filter using GET /v1/user/areas tree",
            "Found TODO in `apps/siutindei_app/lib/features/search/"
            "screens/search_screen.dart` line 347:",
        ),
        (
            "Add reviews to activities",
            "",
        ),
        (
            "NOTE: we should document this later",
            "Human-written issue without the comment-tag filer signature.",
        ),
        ("", "Found tag in `foo.py` line 1:"),
        ("NOTE: something", ""),
    ],
)
def test_does_not_match_product_or_human_issues(title: str, body: str) -> None:
    assert note_tag_issue.is_auto_filed_note_issue(title, body) is False


def test_cli_exits_zero_for_match() -> None:
    assert (
        note_tag_issue.main(
            [
                "--title",
                "NOTE: User authorizer runs outside VPC for JWKS",
                "--body",
                "Found tag in `api-stack.ts` line 1455:",
            ]
        )
        == 0
    )


def test_cli_exits_one_for_non_match() -> None:
    assert (
        note_tag_issue.main(
            ["--title", "Add facilities to locations", "--body", ""]
        )
        == 1
    )
