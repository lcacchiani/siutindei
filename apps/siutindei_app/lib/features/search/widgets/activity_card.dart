import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/constants.dart';
import '../../../config/tokens/tokens.dart';
import '../../../core/core.dart';
import '../../../models/activity_models.dart';

/// Activity card widget using leaf tokens.
///
/// This widget demonstrates the token consumption pattern:
/// - Uses [ActivityCardTokens] for all styling decisions
/// - Easy to restyle by changing token values
/// - Consistent with other cards via shared token structure
class ActivityCard extends ConsumerWidget {
  const ActivityCard({
    super.key,
    required this.result,
    this.onTap,
    this.onOrganizationTap,
  });

  final ActivitySearchResult result;
  final VoidCallback? onTap;
  final VoidCallback? onOrganizationTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Get leaf tokens for this specific component
    final tokens = ref.watch(componentTokensProvider).activityCard;
    final priceTokens = ref.watch(componentTokensProvider).priceTag;
    final semantic = ref.watch(semanticTokensProvider);

    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: semantic.spacing.md,
        vertical: semantic.spacing.sm,
      ),
      decoration: BoxDecoration(
        color: tokens.background,
        borderRadius: BorderRadius.circular(tokens.borderRadius),
        border: Border.all(color: tokens.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(tokens.borderRadius),
          child: Padding(
            padding: EdgeInsets.all(tokens.padding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(tokens),
                SizedBox(height: tokens.gap),
                _buildActivityInfo(tokens),
                SizedBox(height: tokens.gap),
                _buildScheduleAndPrice(tokens, priceTokens, semantic),
                if (result.activity.description != null) ...[
                  SizedBox(height: tokens.gap),
                  _buildDescription(semantic),
                ],
                SizedBox(height: tokens.gap),
                _buildTags(semantic),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ActivityCardTokens tokens) {
    return Row(
      children: [
        BaseAvatar(
          name: result.organization.name,
          imageUrl: result.organization.primaryPictureUrl,
          size: AvatarSize.md,
        ),
        SizedBox(width: tokens.gap),
        Expanded(
          child: GestureDetector(
            onTap: onOrganizationTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  result.organization.name,
                  style: TextStyle(
                    fontSize: tokens.organizationFontSize,
                    fontWeight: FontWeight.w500,
                    color: tokens.organizationColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Row(
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 14,
                      color: tokens.locationIconColor,
                    ),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        result.location.district,
                        style: TextStyle(
                          fontSize: tokens.locationFontSize,
                          color: tokens.locationColor,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityInfo(ActivityCardTokens tokens) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          result.activity.name,
          style: TextStyle(
            fontSize: tokens.titleFontSize,
            fontWeight: tokens.titleFontWeight,
            color: tokens.titleColor,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        if (result.activity.ageMin != null || result.activity.ageMax != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: _AgeTag(
              ageMin: result.activity.ageMin,
              ageMax: result.activity.ageMax,
              tokens: tokens,
            ),
          ),
      ],
    );
  }

  Widget _buildScheduleAndPrice(
    ActivityCardTokens tokens,
    PriceTagTokens priceTokens,
    SemanticTokens semantic,
  ) {
    return Row(
      children: [
        Expanded(
          child: _ScheduleInfo(
            schedule: result.schedule,
            tokens: tokens,
          ),
        ),
        SizedBox(width: semantic.spacing.md),
        _PriceTag(
          pricing: result.pricing,
          tokens: priceTokens,
        ),
      ],
    );
  }

  Widget _buildDescription(SemanticTokens semantic) {
    return Text(
      result.activity.description!,
      style: semantic.text.bodySmall.copyWith(height: 1.4),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildTags(SemanticTokens semantic) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        // Language tags
        ...result.schedule.languages.take(3).map(
              (lang) => BaseBadge(label: lang.toUpperCase()),
            ),
        // Pricing type tag
        BaseBadge(
          label: AppConstants.getPricingTypeName(result.pricing.pricingType),
          variant: BadgeVariant.success,
        ),
      ],
    );
  }
}

class _AgeTag extends StatelessWidget {
  const _AgeTag({
    required this.ageMin,
    required this.ageMax,
    required this.tokens,
  });

  final int? ageMin;
  final int? ageMax;
  final ActivityCardTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.child_care,
          size: 14,
          color: tokens.ageForeground,
        ),
        const SizedBox(width: 4),
        Text(
          _formatAgeRange(),
          style: TextStyle(
            fontSize: tokens.ageFontSize,
            color: tokens.ageForeground,
          ),
        ),
      ],
    );
  }

  String _formatAgeRange() {
    if (ageMin != null && ageMax != null) {
      return 'Ages $ageMin-$ageMax';
    } else if (ageMin != null) {
      return 'Ages $ageMin+';
    } else if (ageMax != null) {
      return 'Up to age $ageMax';
    }
    return 'All ages';
  }
}

class _ScheduleInfo extends StatelessWidget {
  const _ScheduleInfo({
    required this.schedule,
    required this.tokens,
  });

  final Schedule schedule;
  final ActivityCardTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          Icons.schedule,
          size: 16,
          color: tokens.scheduleIconColor,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            _formatSchedule(),
            style: TextStyle(
              fontSize: tokens.scheduleFontSize,
              color: tokens.scheduleColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String _formatSchedule() {
    final parts = <String>[];

    if (schedule.dayOfWeekUtc != null) {
      parts.add(AppConstants.getDayNameShort(schedule.dayOfWeekUtc!));
    } else if (schedule.dayOfMonth != null) {
      parts.add('Day ${schedule.dayOfMonth}');
    }

    if (schedule.startMinutesUtc != null) {
      final timeStr = AppConstants.minutesToTimeString(schedule.startMinutesUtc!);
      if (schedule.endMinutesUtc != null) {
        parts.add('$timeStr - ${AppConstants.minutesToTimeString(schedule.endMinutesUtc!)}');
      } else {
        parts.add(timeStr);
      }
    }

    if (parts.isEmpty) {
      return schedule.scheduleType == 'date_specific'
          ? 'One-time event'
          : 'See details';
    }

    return parts.join(' • ');
  }
}

class _PriceTag extends StatelessWidget {
  const _PriceTag({
    required this.pricing,
    required this.tokens,
  });

  final Pricing pricing;
  final PriceTagTokens tokens;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: tokens.paddingHorizontal,
        vertical: tokens.paddingVertical,
      ),
      decoration: BoxDecoration(
        color: tokens.background,
        borderRadius: BorderRadius.circular(tokens.borderRadius),
      ),
      child: Text(
        '${pricing.currency} ${pricing.amount.toStringAsFixed(0)}',
        style: TextStyle(
          fontSize: tokens.fontSize,
          fontWeight: tokens.fontWeight,
          color: tokens.foreground,
        ),
      ),
    );
  }
}
