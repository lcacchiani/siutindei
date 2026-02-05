import 'package:flutter/material.dart';

import '../../config/app_theme.dart';
import '../../models/activity_models.dart';
import 'organization_detail_screen.dart';

/// Screen displaying detailed information about an activity.
class ActivityDetailScreen extends StatelessWidget {
  const ActivityDetailScreen({
    super.key,
    required this.result,
  });

  final ActivitySearchResult result;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildActivityHeader(),
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildOrganizationCard(context),
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildScheduleSection(),
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildPricingSection(),
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildLocationSection(context),
                  if (result.activity.description != null) ...[
                    const SizedBox(height: AppTheme.spacingLg),
                    _buildDescriptionSection(),
                  ],
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildLanguagesSection(),
                  const SizedBox(height: AppTheme.spacingXl),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(context),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        background: _buildHeaderImage(),
      ),
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.arrow_back, color: AppTheme.textPrimary),
        ),
      ),
      actions: [
        IconButton(
          onPressed: () {
            // Share functionality
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Share coming soon!')),
            );
          },
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.9),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.share, color: AppTheme.textPrimary),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildHeaderImage() {
    final imageUrl = result.organization.primaryPictureUrl;
    if (imageUrl != null) {
      return Image.network(
        imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildPlaceholderImage(),
      );
    }
    return _buildPlaceholderImage();
  }

  Widget _buildPlaceholderImage() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.primaryColor.withValues(alpha: 0.8),
            AppTheme.primaryDark,
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.sports_soccer,
          size: 64,
          color: Colors.white.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  Widget _buildActivityHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          result.activity.name,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        if (result.activity.ageMin != null || result.activity.ageMax != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.secondaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.child_care,
                        size: 16,
                        color: AppTheme.secondaryColor,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _formatAgeRange(
                            result.activity.ageMin, result.activity.ageMax),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.secondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildOrganizationCard(BuildContext context) {
    return _SectionCard(
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => OrganizationDetailScreen(
                organization: result.organization,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          child: Row(
            children: [
              _OrganizationAvatar(
                imageUrl: result.organization.primaryPictureUrl,
                name: result.organization.name,
              ),
              const SizedBox(width: AppTheme.spacingMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      result.organization.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    if (result.organization.description != null)
                      Text(
                        result.organization.description!,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppTheme.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScheduleSection() {
    return _SectionCard(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.schedule,
              title: 'Schedule',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            _buildScheduleDetails(),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleDetails() {
    final schedule = result.schedule;
    final details = <Widget>[];

    // Schedule type
    details.add(_DetailRow(
      label: 'Type',
      value: _formatScheduleType(schedule.scheduleType),
    ));

    // Day
    if (schedule.dayOfWeekUtc != null) {
      details.add(_DetailRow(
        label: 'Day',
        value: _dayName(schedule.dayOfWeekUtc!),
      ));
    } else if (schedule.dayOfMonth != null) {
      details.add(_DetailRow(
        label: 'Day of Month',
        value: schedule.dayOfMonth.toString(),
      ));
    }

    // Time
    if (schedule.startMinutesUtc != null) {
      String timeValue = AppConstants.minutesToTimeString(schedule.startMinutesUtc!);
      if (schedule.endMinutesUtc != null) {
        timeValue += ' - ${AppConstants.minutesToTimeString(schedule.endMinutesUtc!)}';
      }
      details.add(_DetailRow(
        label: 'Time',
        value: timeValue,
      ));
    }

    // Date-specific
    if (schedule.startAtUtc != null) {
      details.add(_DetailRow(
        label: 'Date',
        value: _formatDateTime(schedule.startAtUtc!),
      ));
    }

    return Column(children: details);
  }

  Widget _buildPricingSection() {
    return _SectionCard(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.payments_outlined,
              title: 'Pricing',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${result.pricing.currency} ${result.pricing.amount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primaryColor,
                  ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    _formatPricingType(result.pricing.pricingType),
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
            if (result.pricing.sessionsCount != null) ...[
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                '${result.pricing.sessionsCount} sessions included',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLocationSection(BuildContext context) {
    return _SectionCard(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.location_on_outlined,
              title: 'Location',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            _DetailRow(
              label: 'District',
              value: result.location.district,
            ),
            if (result.location.address != null)
              _DetailRow(
                label: 'Address',
                value: result.location.address!,
              ),
            if (result.location.lat != null && result.location.lng != null)
              Padding(
                padding: const EdgeInsets.only(top: AppTheme.spacingSm),
                child: OutlinedButton.icon(
                  onPressed: () {
                    // Open maps
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Maps integration coming soon!')),
                    );
                  },
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: const Text('View on Map'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDescriptionSection() {
    return _SectionCard(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.info_outline,
              title: 'About',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              result.activity.description!,
              style: const TextStyle(
                fontSize: 14,
                color: AppTheme.textSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLanguagesSection() {
    if (result.schedule.languages.isEmpty) {
      return const SizedBox.shrink();
    }

    return _SectionCard(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SectionTitle(
              icon: Icons.language,
              title: 'Languages',
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: result.schedule.languages.map((lang) {
                final displayName = AppConstants.languageOptions[lang] ?? lang;
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  ),
                  child: Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        border: Border(
          top: BorderSide(color: AppTheme.borderColor),
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${result.pricing.currency} ${result.pricing.amount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                Text(
                  _formatPricingType(result.pricing.pricingType),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Booking coming soon!')),
                );
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
              ),
              child: const Text('Book Now'),
            ),
          ],
        ),
      ),
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

  String _formatScheduleType(String type) {
    switch (type) {
      case 'weekly':
        return 'Weekly recurring';
      case 'monthly':
        return 'Monthly recurring';
      case 'date_specific':
        return 'One-time event';
      default:
        return type;
    }
  }

  String _formatPricingType(String type) {
    switch (type) {
      case 'per_class':
        return 'per class';
      case 'per_month':
        return 'per month';
      case 'per_sessions':
        return 'per package';
      default:
        return type;
    }
  }

  String _dayName(int dayOfWeek) {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];
    return days[dayOfWeek % 7];
  }

  String _formatDateTime(String isoDate) {
    try {
      final date = DateTime.parse(isoDate);
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return isoDate;
    }
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(color: AppTheme.borderColor),
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.title,
  });

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.textSecondary),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: AppTheme.textTertiary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                color: AppTheme.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
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
      width: 48,
      height: 48,
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
          fontSize: 16,
        ),
      ),
    );
  }
}
