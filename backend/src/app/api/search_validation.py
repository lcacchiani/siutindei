"""Search query parameter validation."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from app.api.admin_validators import _validate_language_code
from app.exceptions import ValidationError


def validate_search_query_params(
    *,
    age: Optional[int],
    day_of_week_utc: Optional[int],
    start_minutes_utc: Optional[int],
    end_minutes_utc: Optional[int],
    price_min: Optional[Decimal],
    price_max: Optional[Decimal],
    languages: list[str],
    limit: int,
) -> list[str]:
    """Validate search filters against the OpenAPI contract."""

    if age is not None and age < 0:
        raise ValidationError("age must be >= 0", field="age")

    if day_of_week_utc is not None and not 0 <= day_of_week_utc <= 6:
        raise ValidationError(
            "day_of_week_utc must be between 0 and 6",
            field="day_of_week_utc",
        )

    if start_minutes_utc is not None and not 0 <= start_minutes_utc <= 1439:
        raise ValidationError(
            "start_minutes_utc must be between 0 and 1439",
            field="start_minutes_utc",
        )

    if end_minutes_utc is not None and not 0 <= end_minutes_utc <= 1439:
        raise ValidationError(
            "end_minutes_utc must be between 0 and 1439",
            field="end_minutes_utc",
        )

    if (
        start_minutes_utc is not None
        and end_minutes_utc is not None
        and start_minutes_utc >= end_minutes_utc
    ):
        raise ValidationError(
            "start_minutes_utc must be less than end_minutes_utc",
            field="start_minutes_utc",
        )

    if price_min is not None and price_min < 0:
        raise ValidationError("price_min must be >= 0", field="price_min")

    if price_max is not None and price_max < 0:
        raise ValidationError("price_max must be >= 0", field="price_max")

    if price_min is not None and price_max is not None and price_min > price_max:
        raise ValidationError(
            "price_min must be less than or equal to price_max",
            field="price_min",
        )

    if limit < 1 or limit > 200:
        raise ValidationError("limit must be between 1 and 200", field="limit")

    validated_languages: list[str] = []
    for index, language in enumerate(languages):
        code = _validate_language_code(language, f"language[{index}]")
        if code not in validated_languages:
            validated_languages.append(code)

    return validated_languages
