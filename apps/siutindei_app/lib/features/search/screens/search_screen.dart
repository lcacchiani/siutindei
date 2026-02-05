import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/constants.dart';
import '../../../config/tokens/tokens.dart';
import '../../../models/activity_models.dart';
import '../../../viewmodels/activities_viewmodel.dart';
import '../../../viewmodels/auth_viewmodel.dart';
import '../../activity_detail/screens/activity_detail_screen.dart';
import '../../auth/screens/login_screen.dart';
import '../../organization/screens/organization_screen.dart';
import '../widgets/activity_card.dart';
import '../widgets/filter_chip_bar.dart';
import '../widgets/search_filters_sheet.dart';

/// Main search screen using the design token system.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  ActivitySearchFilters _filters = ActivitySearchFilters();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _performSearch());
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      final state = ref.read(activitiesViewModelProvider);
      if (!state.isLoading && state.nextCursor != null) {
        _loadMore();
      }
    }
  }

  void _performSearch() {
    final searchQuery = _searchController.text.trim();
    final filters = _filters.copyWith(
      searchQuery: searchQuery.isEmpty ? null : searchQuery,
      clearSearchQuery: searchQuery.isEmpty,
      clearCursor: true,
    );
    setState(() => _filters = filters);
    ref.read(activitiesViewModelProvider.notifier).search(filters);
  }

  void _loadMore() {
    ref.read(activitiesViewModelProvider.notifier).loadMore(_filters);
  }

  void _updateFilters(ActivitySearchFilters filters) {
    setState(() => _filters = filters.copyWith(clearCursor: true));
    ref.read(activitiesViewModelProvider.notifier).search(_filters);
  }

  void _showFiltersSheet() {
    SearchFiltersSheet.show(
      context: context,
      initialFilters: _filters,
      onApply: _updateFilters,
    );
  }

  void _toggleDayFilter(int dayOfWeek) {
    if (_filters.dayOfWeekUtc == dayOfWeek) {
      _updateFilters(_filters.copyWith(clearDayOfWeekUtc: true));
    } else {
      _updateFilters(_filters.copyWith(dayOfWeekUtc: dayOfWeek));
    }
  }

  void _toggleDistrictFilter(String? district) {
    if (_filters.district == district || district == null) {
      _updateFilters(_filters.copyWith(clearDistrict: true));
    } else {
      _updateFilters(_filters.copyWith(district: district));
    }
  }

  @override
  Widget build(BuildContext context) {
    final activitiesState = ref.watch(activitiesViewModelProvider);
    final authState = ref.watch(authViewModelProvider);
    final semantic = ref.watch(semanticTokensProvider);
    final tokens = ref.watch(componentTokensProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(authState, semantic),
            _buildSearchBar(tokens, semantic),
            _buildQuickFilters(semantic),
            Expanded(child: _buildResultsList(activitiesState, semantic)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(AuthState authState, SemanticTokens semantic) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        semantic.spacing.md,
        semantic.spacing.md,
        semantic.spacing.md,
        semantic.spacing.sm,
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Find Activities', style: semantic.text.headlineMedium),
              const SizedBox(height: 2),
              Text(
                'Discover classes and events for kids',
                style: semantic.text.bodySmall,
              ),
            ],
          ),
          const Spacer(),
          IconButton(
            onPressed: () {
              if (authState.isSignedIn) {
                ref.read(authViewModelProvider.notifier).signOut();
              } else {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
            icon: Icon(
              authState.isSignedIn ? Icons.logout : Icons.person_outline,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(ComponentTokens tokens, SemanticTokens semantic) {
    final searchTokens = tokens.searchBar;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: semantic.spacing.md,
        vertical: semantic.spacing.sm,
      ),
      child: Container(
        height: searchTokens.height,
        decoration: BoxDecoration(
          color: searchTokens.background,
          borderRadius: BorderRadius.circular(searchTokens.borderRadius),
          border: Border.all(color: searchTokens.border),
        ),
        child: TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search activities, organizations...',
            hintStyle: TextStyle(color: searchTokens.placeholder),
            prefixIcon: Icon(Icons.search, color: searchTokens.icon),
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    onPressed: () {
                      _searchController.clear();
                      _performSearch();
                    },
                    icon: Icon(Icons.clear, color: searchTokens.clearIcon),
                  )
                : null,
            border: InputBorder.none,
            contentPadding: EdgeInsets.symmetric(
              horizontal: searchTokens.padding,
              vertical: 12,
            ),
          ),
          onSubmitted: (_) => _performSearch(),
          textInputAction: TextInputAction.search,
        ),
      ),
    );
  }

  Widget _buildQuickFilters(SemanticTokens semantic) {
    return Padding(
      padding: EdgeInsets.only(bottom: semantic.spacing.sm),
      child: Column(
        children: [
          FilterChipBar(
            children: [
              FilterBadge(
                count: _filters.activeFilterCount,
                onTap: _showFiltersSheet,
              ),
              ...List.generate(7, (index) {
                return TokenFilterChip(
                  label: AppConstants.daysOfWeekShort[index],
                  selected: _filters.dayOfWeekUtc == index,
                  onSelected: (_) => _toggleDayFilter(index),
                );
              }),
            ],
          ),
          SizedBox(height: semantic.spacing.sm),
          FilterChipBar(
            children: [
              DropdownFilterChip(
                label: 'District',
                value: _filters.district,
                options: AppConstants.districts,
                onChanged: _toggleDistrictFilter,
              ),
              DropdownFilterChip(
                label: 'Pricing',
                value: _filters.pricingType,
                options: AppConstants.pricingTypes.keys.toList(),
                displayNameBuilder: AppConstants.getPricingTypeName,
                onChanged: (value) {
                  if (value == null) {
                    _updateFilters(_filters.copyWith(clearPricingType: true));
                  } else {
                    _updateFilters(_filters.copyWith(pricingType: value));
                  }
                },
              ),
              DropdownFilterChip(
                label: 'Schedule',
                value: _filters.scheduleType,
                options: AppConstants.scheduleTypes.keys.toList(),
                displayNameBuilder: AppConstants.getScheduleTypeName,
                onChanged: (value) {
                  if (value == null) {
                    _updateFilters(_filters.copyWith(clearScheduleType: true));
                  } else {
                    _updateFilters(_filters.copyWith(scheduleType: value));
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildResultsList(ActivitiesState state, SemanticTokens semantic) {
    if (state.isLoading && state.items.isEmpty) {
      return Center(
        child: CircularProgressIndicator(color: semantic.color.primary),
      );
    }

    if (state.errorMessage != null && state.items.isEmpty) {
      return _buildErrorState(state.errorMessage!, semantic);
    }

    if (state.items.isEmpty) {
      return _buildEmptyState(semantic);
    }

    return RefreshIndicator(
      onRefresh: () async {
        _performSearch();
        await Future.delayed(const Duration(milliseconds: 500));
      },
      child: ListView.builder(
        controller: _scrollController,
        padding: EdgeInsets.only(top: semantic.spacing.sm),
        itemCount: state.items.length + (state.nextCursor != null ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= state.items.length) {
            return _buildLoadMoreIndicator(state, semantic);
          }
          final result = state.items[index];
          return ActivityCard(
            result: result,
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ActivityDetailScreen(result: result),
              ),
            ),
            onOrganizationTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => OrganizationScreen(
                  organization: result.organization,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLoadMoreIndicator(ActivitiesState state, SemanticTokens semantic) {
    return Padding(
      padding: EdgeInsets.all(semantic.spacing.md),
      child: Center(
        child: state.isLoading
            ? CircularProgressIndicator(color: semantic.color.primary)
            : TextButton(onPressed: _loadMore, child: const Text('Load more')),
      ),
    );
  }

  Widget _buildEmptyState(SemanticTokens semantic) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(semantic.spacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: semantic.color.textTertiary.withValues(alpha: 0.5),
            ),
            SizedBox(height: semantic.spacing.md),
            Text('No activities found', style: semantic.text.titleMedium),
            SizedBox(height: semantic.spacing.sm),
            Text(
              'Try adjusting your filters or search terms',
              style: semantic.text.bodySmall,
              textAlign: TextAlign.center,
            ),
            SizedBox(height: semantic.spacing.lg),
            OutlinedButton(
              onPressed: () {
                setState(() {
                  _filters = ActivitySearchFilters();
                  _searchController.clear();
                });
                _performSearch();
              },
              child: const Text('Clear filters'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message, SemanticTokens semantic) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(semantic.spacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: semantic.color.error.withValues(alpha: 0.7),
            ),
            SizedBox(height: semantic.spacing.md),
            Text('Something went wrong', style: semantic.text.titleMedium),
            SizedBox(height: semantic.spacing.sm),
            Text(
              message,
              style: semantic.text.caption,
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: semantic.spacing.lg),
            ElevatedButton(
              onPressed: _performSearch,
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
