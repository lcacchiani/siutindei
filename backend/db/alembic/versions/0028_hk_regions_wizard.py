"""Add HK macro regions and wizard activity categories.

Inserts Hong Kong Island, Kowloon, New Territories, and Islands as
level=region nodes under Hong Kong, reparents districts beneath them,
and seeds workshop/class/outdoor/indoor categories for the home wizard.
"""

from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0028_hk_regions_wizard"
down_revision: Union[str, None] = "0027_add_feedback_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

HK_ISLAND_ID = "a1111111-1111-1111-1111-111111111101"
KOWLOON_ID = "a1111111-1111-1111-1111-111111111102"
NEW_TERRITORIES_ID = "a1111111-1111-1111-1111-111111111103"
ISLANDS_ID = "a1111111-1111-1111-1111-111111111104"

WORKSHOP_CATEGORY_ID = "c1111111-1111-1111-1111-111111111101"
CLASS_CATEGORY_ID = "c1111111-1111-1111-1111-111111111102"
OUTDOOR_CATEGORY_ID = "c1111111-1111-1111-1111-111111111103"
INDOOR_CATEGORY_ID = "c1111111-1111-1111-1111-111111111104"

HK_ISLAND_DISTRICTS = (
    "Central and Western",
    "Eastern",
    "Southern",
    "Wan Chai",
)
KOWLOON_DISTRICTS = (
    "Kowloon City",
    "Kwun Tong",
    "Sham Shui Po",
    "Wong Tai Sin",
    "Yau Tsim Mong",
)
NEW_TERRITORIES_DISTRICTS = (
    "Kwai Tsing",
    "North",
    "Sai Kung",
    "Sha Tin",
    "Tai Po",
    "Tsuen Wan",
    "Tuen Mun",
    "Yuen Long",
)
ISLANDS_DISTRICTS = ("Islands",)


def _insert_region(
    region_id: str,
    name: str,
    code: str,
    name_en: str,
    name_zh: str,
    display_order: int,
) -> None:
    op.execute(
        sa.text(
            f"""
            INSERT INTO geographic_areas (
                id, parent_id, name, name_translations, level, code,
                active, display_order
            )
            SELECT '{region_id}'::uuid, hk.id, :name,
                   jsonb_build_object('en', :name_en, 'zh-HK', :name_zh),
                   'region', :code, true, :display_order
            FROM geographic_areas hk
            WHERE hk.code = 'HK' AND hk.level = 'country'
              AND NOT EXISTS (
                  SELECT 1 FROM geographic_areas
                  WHERE id = '{region_id}'::uuid
              )
            """
        ).bindparams(
            name=name,
            name_en=name_en,
            name_zh=name_zh,
            code=code,
            display_order=display_order,
        )
    )


def _reparent_districts(region_id: str, district_names: tuple[str, ...]) -> None:
    for district_name in district_names:
        op.execute(
            sa.text(
                f"""
                UPDATE geographic_areas
                SET parent_id = '{region_id}'::uuid
                WHERE level = 'district'
                  AND name = :district_name
                  AND parent_id IN (
                      SELECT id FROM geographic_areas
                      WHERE code = 'HK' AND level = 'country'
                  )
                """
            ).bindparams(district_name=district_name)
        )


def upgrade() -> None:
    """Insert HK regions, reparent districts, and seed wizard categories."""
    _insert_region(
        HK_ISLAND_ID,
        "Hong Kong Island",
        "hk_island",
        "Hong Kong Island",
        "香港島",
        1,
    )
    _insert_region(
        KOWLOON_ID,
        "Kowloon",
        "hk_kowloon",
        "Kowloon",
        "九龍",
        2,
    )
    _insert_region(
        NEW_TERRITORIES_ID,
        "New Territories",
        "hk_new_territories",
        "New Territories",
        "新界",
        3,
    )
    _insert_region(
        ISLANDS_ID,
        "Islands",
        "hk_islands",
        "Islands",
        "離島",
        4,
    )

    _reparent_districts(HK_ISLAND_ID, HK_ISLAND_DISTRICTS)
    _reparent_districts(KOWLOON_ID, KOWLOON_DISTRICTS)
    _reparent_districts(NEW_TERRITORIES_ID, NEW_TERRITORIES_DISTRICTS)
    _reparent_districts(ISLANDS_ID, ISLANDS_DISTRICTS)

    for category_id, name, translations, display_order in (
        (
            WORKSHOP_CATEGORY_ID,
            "Workshop",
            '{"en": "Workshop", "zh-HK": "工作坊"}',
            2,
        ),
        (
            CLASS_CATEGORY_ID,
            "Class",
            '{"en": "Class", "zh-HK": "課程"}',
            3,
        ),
        (
            OUTDOOR_CATEGORY_ID,
            "Outdoor activity",
            '{"en": "Outdoor activity", "zh-HK": "戶外活動"}',
            4,
        ),
        (
            INDOOR_CATEGORY_ID,
            "Indoor fun",
            '{"en": "Indoor fun", "zh-HK": "室內玩樂"}',
            5,
        ),
    ):
        op.execute(
            f"""
            INSERT INTO activity_categories (
                id, parent_id, name, name_translations, display_order
            )
            SELECT '{category_id}'::uuid, NULL, '{name}',
                   '{translations}'::jsonb, {display_order}
            WHERE NOT EXISTS (
                SELECT 1 FROM activity_categories
                WHERE id = '{category_id}'::uuid
            )
            """
        )

    op.execute(
        sa.text(
            f"""
            UPDATE activities
            SET category_id = '{WORKSHOP_CATEGORY_ID}'::uuid
            WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE activities
            SET category_id = '{CLASS_CATEGORY_ID}'::uuid
            WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
            """
        )
    )


def downgrade() -> None:
    """Restore flat HK districts and remove wizard categories."""
    op.execute(
        """
        UPDATE activities
        SET category_id = '99999999-9999-9999-9999-999999999999'
        WHERE id IN (
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
        )
        """
    )
    op.execute(
        f"""
        DELETE FROM activity_categories
        WHERE id IN (
            '{WORKSHOP_CATEGORY_ID}'::uuid,
            '{CLASS_CATEGORY_ID}'::uuid,
            '{OUTDOOR_CATEGORY_ID}'::uuid,
            '{INDOOR_CATEGORY_ID}'::uuid
        )
        """
    )

    op.execute(
        f"""
        UPDATE geographic_areas AS district
        SET parent_id = hk.id
        FROM geographic_areas hk
        WHERE hk.code = 'HK'
          AND hk.level = 'country'
          AND district.level = 'district'
          AND district.parent_id IN (
              '{HK_ISLAND_ID}'::uuid,
              '{KOWLOON_ID}'::uuid,
              '{NEW_TERRITORIES_ID}'::uuid,
              '{ISLANDS_ID}'::uuid
          )
        """
    )
    op.execute(
        f"""
        DELETE FROM geographic_areas
        WHERE id IN (
            '{HK_ISLAND_ID}'::uuid,
            '{KOWLOON_ID}'::uuid,
            '{NEW_TERRITORIES_ID}'::uuid,
            '{ISLANDS_ID}'::uuid
        )
        """
    )
