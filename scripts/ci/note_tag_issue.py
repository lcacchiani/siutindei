#!/usr/bin/env python3
"""Detect auto-filed NOTE / SECURITY NOTE comment-tag issues.

Cursor's comment-tag filer opens issues whose titles start with
``NOTE:`` or ``SECURITY NOTE:`` and whose bodies contain
``Found tag in``. Those comments are architectural documentation, not
defects. Real product work uses ``TODO:`` and is left alone.
"""

from __future__ import annotations

import argparse
import sys


def is_auto_filed_note_issue(title: str, body: str) -> bool:
    """Return True when an issue was filed from a NOTE comment tag."""
    normalized_title = (title or "").strip()
    if not (
        normalized_title.startswith("NOTE:")
        or normalized_title.startswith("SECURITY NOTE:")
    ):
        return False
    return "Found tag in" in (body or "")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Exit 0 if the issue is an auto-filed NOTE tag.",
    )
    parser.add_argument("--title", required=True)
    parser.add_argument(
        "--body",
        default="",
        help="Issue body text. Ignored when --body-file is set.",
    )
    parser.add_argument(
        "--body-file",
        help="Read the issue body from a file instead of --body.",
    )
    args = parser.parse_args(argv)

    body = args.body
    if args.body_file:
        with open(args.body_file, encoding="utf-8") as handle:
            body = handle.read()

    return 0 if is_auto_filed_note_issue(args.title, body) else 1


if __name__ == "__main__":
    sys.exit(main())
