import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/constants.dart';
import '../../../config/tokens/tokens.dart';
import '../../../core/core.dart';
import '../../../models/activity_models.dart';
import '../../organization/screens/organization_screen.dart';

/// Activity detail screen using design tokens.
class ActivityDetailScreen extends ConsumerWidget {
  const ActivityDetailScreen({super.key, required this.result});

  final ActivitySearchResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final semantic = ref.watch(semanticTokensProvider);
    final tokens = ref.watch(componentTokensProvider);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context, semantic),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(semantic.spacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildActivityHeader(semantic, tokens),
                  SizedBox(height: semantic.spacing.lg),
                  _buildOrganizationCard(context, ref, semantic),
                  SizedBox(height: semantic.spacing.lg),
                  _buildScheduleSection(semantic, tokens),
                  SizedBox(height: semantic.spacing.lg),
                  _buildPricingSection(semantic, tokens),
                  SizedBox(height: semantic.spacing.lg),
                  _buildLocationSection(context, semantic, tokens),
                  if (result.activity.description != null) ...[
                    SizedBox(height: semantic.spacing.lg),
                    _buildDescriptionSection(semantic, tokens),
                  ],
                  SizedBox(height: semantic.spacing.lg),
                  _buildLanguagesSection(semantic),
                  SizedBox(height: semantic.spacing.xl),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(context, semantic, tokens),
    );
  }

  Widget _buildAppBar(BuildContext context, SemanticTokens semantic) {
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(background: _buildHeaderImage(semantic)),
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: semantic.color.surface.withValues(alpha: 0.9),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.arrow_back, color: semantic.color.textPrimary),
        ),
      ),
      actions: [
        IconButton(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Share coming soon!')),
            );
          },
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: semantic.color.surface.withValues(alpha: 0.9),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.share, color: semantic.color.textPrimary),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildHeaderImage(SemanticTokens semantic) {
    final imageUrl = result.organization.primaryPictureUrl;
    if (imageUrl != null) {
      return Image.network(
        imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildPlaceholderImage(semantic),
      );
    }
    return _buildPlaceholderImage(semantic);
  }

  Widget _buildPlaceholderImage(SemanticTokens semantic) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            semantic.color.primary.withValues(alpha: 0.8),
            semantic.color.primaryPressed,
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.sports_soccer,
          size: 64,
          color: semantic.color.onPrimary.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  Widget _buildActivityHeader(SemanticTokens semantic, ComponentTokens tokens) {
    final activityTokens = tokens.activityCard;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(result.activity.name, style: semantic.text.headlineMedium),
        if (result.activity.ageMin != null || result.activity.ageMax != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: activityTokens.ageBackground,
                borderRadius: BorderRadius.circular(semantic.radius.sm),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.child_care, size: 16, color: activityTokens.ageForeground),
                  const SizedBox(width: 4),
                  Text(
                    _formatAgeRange(),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: activityTokens.ageForeground,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildOrganizationCard(BuildContext context, WidgetRef ref, SemanticTokens semantic) {
    return BaseCard(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OrganizationScreen(organization: result.organization),
        ),
      ),
      child: Row(
        children: [
          BaseAvatar(
            name: result.organization.name,
            imageUrl: result.organization.primaryPictureUrl,
            size: AvatarSize.lg,
          ),
          SizedBox(width: semantic.spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(result.organization.name, style: semantic.text.titleMedium),
                if (result.organization.description != null)
                  Text(
                    result.organization.description!,
                    style: semantic.text.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: semantic.color.textTertiary),
        ],
      ),
    );
  }

  Widget _buildScheduleSection(SemanticTokens semantic, ComponentTokens tokens) {
    return SectionCard(
      title: 'Schedule',
      icon: Icons.schedule,
      child: Column(
        children: [
          _DetailRow(
            label: 'Type',
            value: AppConstants.getScheduleTypeName(result.schedule.scheduleType),
            semantic: semantic,
          ),
          if (result.schedule.dayOfWeekUtc != null)
            _DetailRow(
              label: 'Day',
              value: AppConstants.getDayName(result.schedule.dayOfWeekUtc!),
              semantic: semantic,
            ),
          if (result.schedule.startMinutesUtc != null)
            _DetailRow(
              label: 'Time',
              value: _formatTimeRange(),
              semantic: semantic,
            ),
        ],
      ),
    );
  }

  Widget _buildPricingSection(SemanticTokens semantic, ComponentTokens tokens) {
    final priceTokens = tokens.priceTag;

    return SectionCard(
      title: 'Pricing',
      icon: Icons.payments_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${result.pricing.currency} ${result.pricing.amount.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: priceTokens.foreground,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  AppConstants.getPricingTypeName(result.pricing.pricingType).toLowerCase(),
                  style: semantic.text.bodyMedium,
                ),
              ),
            ],
          ),
          if (result.pricing.sessionsCount != null) ...[
            SizedBox(height: semantic.spacing.sm),
            Text(
              '${result.pricing.sessionsCount} sessions included',
              style: semantic.text.bodySmall,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLocationSection(BuildContext context, SemanticTokens semantic, ComponentTokens tokens) {
    return SectionCard(
      title: 'Location',
      icon: Icons.location_on_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(label: 'District', value: result.location.district, semantic: semantic),
          if (result.location.address != null)
            _DetailRow(label: 'Address', value: result.location.address!, semantic: semantic),
          if (result.location.lat != null && result.location.lng != null)
            Padding(
              padding: EdgeInsets.only(top: semantic.spacing.sm),
              child: OutlinedButton.icon(
                onPressed: () {
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
    );
  }

  Widget _buildDescriptionSection(SemanticTokens semantic, ComponentTokens tokens) {
    return SectionCard(
      title: 'About',
      icon: Icons.info_outline,
      child: Text(result.activity.description!, style: semantic.text.bodyMedium),
    );
  }

  Widget _buildLanguagesSection(SemanticTokens semantic) {
    if (result.schedule.languages.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      title: 'Languages',
      icon: Icons.language,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: result.schedule.languages.map((lang) {
          return BaseBadge(label: AppConstants.getLanguageName(lang));
        }).toList(),
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context, SemanticTokens semantic, ComponentTokens tokens) {
    final priceTokens = tokens.priceTag;

    return Container(
      padding: EdgeInsets.all(semantic.spacing.md),
      decoration: BoxDecoration(
        color: semantic.color.surface,
        border: Border(top: BorderSide(color: semantic.color.border)),
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
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: priceTokens.foreground,
                  ),
                ),
                Text(
                  AppConstants.getPricingTypeName(result.pricing.pricingType).toLowerCase(),
                  style: semantic.text.caption,
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
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              ),
              child: const Text('Book Now'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatAgeRange() {
    if (result.activity.ageMin != null && result.activity.ageMax != null) {
      return 'Ages ${result.activity.ageMin}-${result.activity.ageMax}';
    } else if (result.activity.ageMin != null) {
      return 'Ages ${result.activity.ageMin}+';
    } else if (result.activity.ageMax != null) {
      return 'Up to age ${result.activity.ageMax}';
    }
    return 'All ages';
  }

  String _formatTimeRange() {
    final start = AppConstants.minutesToTimeString(result.schedule.startMinutesUtc!);
    if (result.schedule.endMinutesUtc != null) {
      return '$start - ${AppConstants.minutesToTimeString(result.schedule.endMinutesUtc!)}';
    }
    return start;
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    required this.semantic,
  });

  final String label;
  final String value;
  final SemanticTokens semantic;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: semantic.spacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: semantic.text.caption),
          ),
          Expanded(
            child: Text(value, style: semantic.text.bodyMedium),
          ),
        ],
      ),
    );
  }
}
