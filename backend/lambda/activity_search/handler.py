"""Lambda entrypoint for activity search."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from typing import Mapping

ROOT_DIR = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT_DIR / "src"
sys.path.append(str(SRC_DIR))

from app.api.activities_search import lambda_handler as _handler  # noqa: E402


def lambda_handler(event: Mapping[str, Any], context: Any) -> dict[str, Any]:
    """Delegate to the activity search handler."""

    return _handler(event, context)
