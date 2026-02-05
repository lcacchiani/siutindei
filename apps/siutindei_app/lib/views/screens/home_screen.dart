import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/app_theme.dart';
import '../../models/activity_models.dart';
import '../../viewmodels/activities_viewmodel.dart';
import '../../viewmodels/auth_viewmodel.dart';
import '../widgets/activity_card.dart';
import '../widgets/filter_chips.dart';
import '../widgets/search_filters_sheet.dart';
import 'activity_detail_screen.dart';
import 'login_screen.dart';
import 'organization_detail_screen.dart';

/// Main home screen with search and activity browsing.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  ActivitySearchFilters _filters = ActivitySearchFilters();

  @override
  void initState() {
    super.initState();
    // Initial search on load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _performSearch();
    });

    // Add scroll listener for infinite scrolling
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
    setState(() {
      _filters = filters;
    });
    ref.read(activitiesViewModelProvider.notifier).search(filters);
  }

  void _loadMore() {
    ref.read(activitiesViewModelProvider.notifier).loadMore(_filters);
  }

  void _updateFilters(ActivitySearchFilters filters) {
    setState(() {
      _filters = filters.copyWith(clearCursor: true);
    });
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

  void _navigateToActivityDetail(ActivitySearchResult result) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ActivityDetailScreen(result: result),
      ),
    );
  }

  void _navigateToOrganizationDetail(ActivitySearchResult result) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OrganizationDetailScreen(
          organization: result.organization,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activitiesState = ref.watch(activitiesViewModelProvider);
    final authState = ref.watch(authViewModelProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(authState),
            _buildSearchBar(),
            _buildQuickFilters(),
            Expanded(
              child: _buildResultsList(activitiesState),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(AuthState authState) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppTheme.spacingMd,
        AppTheme.spacingMd,
        AppTheme.spacingMd,
        AppTheme.spacingSm,
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Find Activities',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Discover classes and events for kids',
                style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.textSecondary,
                ),
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

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search activities, organizations...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  onPressed: () {
                    _searchController.clear();
                    _performSearch();
                  },
                  icon: const Icon(Icons.clear),
                )
              : null,
        ),
        onSubmitted: (_) => _performSearch(),
        textInputAction: TextInputAction.search,
      ),
    );
  }

  Widget _buildQuickFilters() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Column(
        children: [
          // First row: Filter badge and day of week chips
          FilterChipRow(
            children: [
              ActiveFiltersBadge(
                count: _filters.activeFilterCount,
                onTap: _showFiltersSheet,
              ),
              ...List.generate(7, (index) {
                return AppFilterChip(
                  label: AppConstants.daysOfWeekShort[index],
                  selected: _filters.dayOfWeekUtc == index,
                  onSelected: (_) => _toggleDayFilter(index),
                );
              }),
            ],
          ),
          const SizedBox(height: AppTheme.spacingSm),
          // Second row: District dropdown and other quick filters
          FilterChipRow(
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
                displayNameBuilder: (key) =>
                    AppConstants.pricingTypes[key] ?? key,
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
                displayNameBuilder: (key) =>
                    AppConstants.scheduleTypes[key] ?? key,
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

  Widget _buildResultsList(ActivitiesState state) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    if (state.errorMessage != null && state.items.isEmpty) {
      return _buildErrorState(state.errorMessage!);
    }

    if (state.items.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: () async {
        _performSearch();
        // Wait a bit for the search to complete
        await Future.delayed(const Duration(milliseconds: 500));
      },
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.only(top: AppTheme.spacingSm),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  if (index >= state.items.length) {
                    return _buildLoadMoreIndicator(state);
                  }
                  final result = state.items[index];
                  return ActivityCard(
                    result: result,
                    onTap: () => _navigateToActivityDetail(result),
                    onOrganizationTap: () => _navigateToOrganizationDetail(result),
                  );
                },
                childCount: state.items.length + (state.nextCursor != null ? 1 : 0),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadMoreIndicator(ActivitiesState state) {
    return Padding(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Center(
        child: state.isLoading
            ? const CircularProgressIndicator()
            : TextButton(
                onPressed: _loadMore,
                child: const Text('Load more'),
              ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: AppTheme.textTertiary.withValues(alpha: 0.5),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            const Text(
              'No activities found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: AppTheme.spacingSm),
            const Text(
              'Try adjusting your filters or search terms',
              style: TextStyle(
                color: AppTheme.textTertiary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingLg),
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

  Widget _buildErrorState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppTheme.errorColor.withValues(alpha: 0.7),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            const Text(
              'Something went wrong',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              message,
              style: const TextStyle(
                color: AppTheme.textTertiary,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppTheme.spacingLg),
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
