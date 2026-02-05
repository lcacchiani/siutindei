import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/tokens/tokens.dart';
import 'token_aware_widget.dart';

/// Badge variants.
enum BadgeVariant { primary, success, warning, error }

/// Base badge component that consumes badge tokens.
class BaseBadge extends TokenAwareWidget {
  const BaseBadge({
    super.key,
    required this.label,
    this.variant = BadgeVariant.primary,
    this.icon,
  });

  final String label;
  final BadgeVariant variant;
  final IconData? icon;

  @override
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  ) {
    final badgeTokens = tokens.badge;

    final (background, foreground) = switch (variant) {
      BadgeVariant.primary => (badgeTokens.background, badgeTokens.foreground),
      BadgeVariant.success =>
        (badgeTokens.successBackground, badgeTokens.successForeground),
      BadgeVariant.warning =>
        (badgeTokens.warningBackground, badgeTokens.warningForeground),
      BadgeVariant.error =>
        (badgeTokens.errorBackground, badgeTokens.errorForeground),
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: badgeTokens.paddingHorizontal,
        vertical: badgeTokens.paddingVertical,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(badgeTokens.borderRadius),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: badgeTokens.fontSize + 2,
              color: foreground,
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: badgeTokens.fontSize,
              fontWeight: FontWeight.w500,
              color: foreground,
            ),
          ),
        ],
      ),
    );
  }
}

/// Count badge (e.g., filter count).
class CountBadge extends TokenAwareWidget {
  const CountBadge({
    super.key,
    required this.count,
  });

  final int count;

  @override
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  ) {
    final filterTokens = tokens.filterChip;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filterTokens.badgeBackground,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        count.toString(),
        style: TextStyle(
          color: filterTokens.badgeForeground,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
