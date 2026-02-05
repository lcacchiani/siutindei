import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/app_theme.dart';
import '../../models/activity_models.dart';
import '../../viewmodels/activities_viewmodel.dart';
import '../widgets/activity_card.dart';
import 'activity_detail_screen.dart';

/// Screen displaying detailed information about an organization
/// and its activities.
class OrganizationDetailScreen extends ConsumerStatefulWidget {
  const OrganizationDetailScreen({
    super.key,
    required this.organization,
  });

  final Organization organization;

  @override
  ConsumerState<OrganizationDetailScreen> createState() =>
      _OrganizationDetailScreenState();
}

class _OrganizationDetailScreenState
    extends ConsumerState<OrganizationDetailScreen> {
  // In a real app, you'd fetch the organization's activities
  // For now, we'll show activities from the current search that match

  @override
  Widget build(BuildContext context) {
    final activitiesState = ref.watch(activitiesViewModelProvider);

    // Filter activities for this organization
    final orgActivities = activitiesState.items
        .where((item) => item.organization.id == widget.organization.id)
        .toList();

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context),
          SliverToBoxAdapter(
            child: _buildOrganizationInfo(),
          ),
          SliverToBoxAdapter(
            child: _buildImageGallery(),
          ),
          SliverToBoxAdapter(
            child: _buildActivitiesHeader(orgActivities.length),
          ),
          if (orgActivities.isNotEmpty)
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final result = orgActivities[index];
                  return ActivityCard(
                    result: result,
                    onTap: () => _navigateToActivityDetail(result),
                  );
                },
                childCount: orgActivities.length,
              ),
            )
          else
            SliverToBoxAdapter(
              child: _buildNoActivitiesMessage(),
            ),
          const SliverToBoxAdapter(
            child: SizedBox(height: AppTheme.spacingXl),
          ),
        ],
      ),
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
    );
  }

  Widget _buildHeaderImage() {
    final imageUrl = widget.organization.primaryPictureUrl;
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
        child: _buildInitialsAvatar(80),
      ),
    );
  }

  Widget _buildInitialsAvatar(double size) {
    final initials = widget.organization.name.isNotEmpty
        ? widget.organization.name
            .split(' ')
            .take(2)
            .map((e) => e.isNotEmpty ? e[0].toUpperCase() : '')
            .join()
        : '?';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initials,
          style: TextStyle(
            fontSize: size * 0.4,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildOrganizationInfo() {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.organization.name,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          if (widget.organization.description != null) ...[
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              widget.organization.description!,
              style: const TextStyle(
                fontSize: 15,
                color: AppTheme.textSecondary,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: AppTheme.spacingMd),
          Row(
            children: [
              _InfoChip(
                icon: Icons.verified,
                label: 'Verified',
                color: AppTheme.secondaryColor,
              ),
              const SizedBox(width: 8),
              _InfoChip(
                icon: Icons.star,
                label: 'Top Rated',
                color: AppTheme.warningColor,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildImageGallery() {
    if (widget.organization.pictureUrls.length <= 1) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
          child: Text(
            'Gallery',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: AppTheme.spacingSm),
        SizedBox(
          height: 120,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
            itemCount: widget.organization.pictureUrls.length,
            itemBuilder: (context, index) {
              return Padding(
                padding: const EdgeInsets.only(right: AppTheme.spacingSm),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  child: Image.network(
                    widget.organization.pictureUrls[index],
                    width: 160,
                    height: 120,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 160,
                      height: 120,
                      color: AppTheme.backgroundLight,
                      child: const Icon(
                        Icons.broken_image,
                        color: AppTheme.textTertiary,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: AppTheme.spacingMd),
      ],
    );
  }

  Widget _buildActivitiesHeader(int count) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppTheme.spacingMd,
        AppTheme.spacingMd,
        AppTheme.spacingMd,
        AppTheme.spacingSm,
      ),
      child: Row(
        children: [
          const Text(
            'Activities',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: AppTheme.primaryColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              count.toString(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppTheme.primaryColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoActivitiesMessage() {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingXl),
      child: Column(
        children: [
          Icon(
            Icons.calendar_today,
            size: 48,
            color: AppTheme.textTertiary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: AppTheme.spacingMd),
          const Text(
            'No activities in current search',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),
          const Text(
            'Try adjusting your filters to see more activities from this organization',
            style: TextStyle(
              color: AppTheme.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  void _navigateToActivityDetail(ActivitySearchResult result) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ActivityDetailScreen(result: result),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
