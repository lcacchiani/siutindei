import '../../core/utils/result.dart';
import '../entities/entities.dart';

/// Repository interface for activity-related operations.
///
/// This defines the contract for data access. The implementation
/// lives in the data layer and handles API calls, caching, etc.
///
/// ## Usage
///
/// ```dart
/// final repository = ref.watch(activityRepositoryProvider);
/// final result = await repository.searchActivities(filters);
/// switch (result) {
///   case Ok(value: final data):
///     // Handle success
///   case Error(error: final e):
///     // Handle error
/// }
/// ```
abstract interface class ActivityRepository {
  /// Searches for activities matching the given filters.
  ///
  /// Returns [SearchResultsEntity] containing matching activities
  /// and pagination cursor.
  Future<Result<SearchResultsEntity>> searchActivities(SearchFilters filters);

  /// Gets a single activity by ID.
  Future<Result<ActivitySearchResultEntity>> getActivity(String activityId);
}

/// Repository interface for organization-related operations.
abstract interface class OrganizationRepository {
  /// Gets an organization by ID.
  Future<Result<OrganizationEntity>> getOrganization(String organizationId);

  /// Gets all activities for an organization.
  Future<Result<List<ActivitySearchResultEntity>>> getOrganizationActivities(
    String organizationId,
  );
}
