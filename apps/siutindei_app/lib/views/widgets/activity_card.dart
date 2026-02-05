import 'package:flutter/material.dart';

import '../../config/app_theme.dart';
import '../../models/activity_models.dart';

/// A card widget displaying an activity search result.
class ActivityCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(),
              const SizedBox(height: AppTheme.spacingSm),
              _buildActivityInfo(),
              const SizedBox(height: AppTheme.spacingSm),
              _buildScheduleAndPrice(),
              if (result.activity.description != null) ...[
                const SizedBox(height: AppTheme.spacingSm),
                _buildDescription(),
              ],
              const SizedBox(height: AppTheme.spacingSm),
              _buildTags(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        _OrganizationAvatar(
          imageUrl: result.organization.primaryPictureUrl,
          name: result.organization.name,
        ),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: GestureDetector(
            onTap: onOrganizationTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  result.organization.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 14,
                      color: AppTheme.textTertiary,
                    ),
                    const SizedBox(width: 2),
                    Expanded(
                      child: Text(
                        result.location.district,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textTertiary,
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

  Widget _buildActivityInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          result.activity.name,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        if (result.activity.ageMin != null || result.activity.ageMax != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              children: [
                const Icon(
                  Icons.child_care,
                  size: 14,
                  color: AppTheme.textTertiary,
                ),
                const SizedBox(width: 4),
                Text(
                  _formatAgeRange(
                      result.activity.ageMin, result.activity.ageMax),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textTertiary,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildScheduleAndPrice() {
    return Row(
      children: [
        Expanded(
          child: _ScheduleInfo(schedule: result.schedule),
        ),
        const SizedBox(width: AppTheme.spacingMd),
        _PriceTag(pricing: result.pricing),
      ],
    );
  }

  Widget _buildDescription() {
    return Text(
      result.activity.description!,
      style: const TextStyle(
        fontSize: 13,
        color: AppTheme.textSecondary,
        height: 1.4,
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildTags() {
    final tags = <Widget>[];

    // Add language tags
    for (final lang in result.schedule.languages.take(3)) {
      tags.add(_Tag(label: lang.toUpperCase()));
    }

    // Add pricing type tag
    tags.add(_Tag(
      label: _formatPricingType(result.pricing.pricingType),
      color: AppTheme.secondaryColor,
    ));

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: tags,
    );
  }

  String _formatAgeRange(int? min, int? max) {
    if (min != null && max != null) {
      return 'Ages $min-$max';
    } else if (min != null) {
      return 'Ages $min+';
    } else if (max != null) {
      return 'Up to age $max';
    }
    return 'All ages';
  }

  String _formatPricingType(String type) {
    switch (type) {
      case 'per_class':
        return 'Per Class';
      case 'per_month':
        return 'Monthly';
      case 'per_sessions':
        return 'Package';
      default:
        return type;
    }
  }
}

class _OrganizationAvatar extends StatelessWidget {
  const _OrganizationAvatar({
    required this.imageUrl,
    required this.name,
  });

  final String? imageUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null
          ? Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _buildInitials(),
            )
          : _buildInitials(),
    );
  }

  Widget _buildInitials() {
    final initials = name.isNotEmpty
        ? name
            .split(' ')
            .take(2)
            .map((e) => e.isNotEmpty ? e[0].toUpperCase() : '')
            .join()
        : '?';
    return Center(
      child: Text(
        initials,
        style: const TextStyle(
          color: AppTheme.primaryColor,
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
    );
  }
}

class _ScheduleInfo extends StatelessWidget {
  const _ScheduleInfo({required this.schedule});

  final Schedule schedule;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          Icons.schedule,
          size: 16,
          color: AppTheme.textSecondary,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            _formatSchedule(),
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.textSecondary,
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

    // Day info
    if (schedule.dayOfWeekUtc != null) {
      parts.add(_dayName(schedule.dayOfWeekUtc!));
    } else if (schedule.dayOfMonth != null) {
      parts.add('Day ${schedule.dayOfMonth}');
    }

    // Time info
    if (schedule.startMinutesUtc != null) {
      final timeStr = _formatTime(schedule.startMinutesUtc!);
      if (schedule.endMinutesUtc != null) {
        parts.add('$timeStr - ${_formatTime(schedule.endMinutesUtc!)}');
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

  String _dayName(int dayOfWeek) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek % 7];
  }

  String _formatTime(int minutes) {
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    final period = hours >= 12 ? 'PM' : 'AM';
    final displayHours = hours == 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    return '$displayHours:${mins.toString().padLeft(2, '0')} $period';
  }
}

class _PriceTag extends StatelessWidget {
  const _PriceTag({required this.pricing});

  final Pricing pricing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Text(
        '${pricing.currency} ${pricing.amount.toStringAsFixed(0)}',
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppTheme.primaryColor,
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    this.color = AppTheme.primaryColor,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }
}

/// A compact version of the activity card for list views.
class ActivityListTile extends StatelessWidget {
  const ActivityListTile({
    super.key,
    required this.result,
    this.onTap,
  });

  final ActivitySearchResult result;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      leading: _OrganizationAvatar(
        imageUrl: result.organization.primaryPictureUrl,
        name: result.organization.name,
      ),
      title: Text(
        result.activity.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        '${result.organization.name} • ${result.location.district}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 13),
      ),
      trailing: Text(
        '${result.pricing.currency} ${result.pricing.amount.toStringAsFixed(0)}',
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          color: AppTheme.primaryColor,
        ),
      ),
    );
  }
}
