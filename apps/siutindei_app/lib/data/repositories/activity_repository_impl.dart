import '../../core/utils/result.dart';
import '../../domain/entities/entities.dart';
import '../../domain/repositories/repositories.dart';
import '../../services/api_service.dart';
import '../mappers/activity_mapper.dart';

/// Implementation of [ActivityRepository] using the API service.
///
/// This class handles all data access for activities, including
/// API calls and data transformation.
class ActivityRepositoryImpl implements ActivityRepository {
  const ActivityRepositoryImpl(this._apiService);

  final ApiService _apiService;

  @override
  Future<Result<SearchResultsEntity>> searchActivities(
    SearchFilters filters,
  ) async {
    try {
      // Convert domain filters to API model
      final apiFilters = SearchFiltersMapper.toModel(filters);

      // Make API call
      final response = await _apiService.searchActivities(apiFilters);

      // Convert response to domain entity
      final results = ActivityMapper.searchResponseToEntity(response);

      return Result.ok(results);
    } on Exception catch (e) {
      return Result.error(e);
    }
  }

  @override
  Future<Result<ActivitySearchResultEntity>> getActivity(
    String activityId,
  ) async {
    // For now, we don't have a dedicated endpoint for single activity
    // This would typically call a specific API endpoint
    return Result.error(
      UnimplementedError('Single activity endpoint not yet implemented'),
    );
  }
}

/// Implementation of [OrganizationRepository] using the API service.
class OrganizationRepositoryImpl implements OrganizationRepository {
  const OrganizationRepositoryImpl(this._apiService);

  final ApiService _apiService;

  @override
  Future<Result<OrganizationEntity>> getOrganization(
    String organizationId,
  ) async {
    // For now, we don't have a dedicated endpoint for single organization
    return Result.error(
      UnimplementedError('Single organization endpoint not yet implemented'),
    );
  }

  @override
  Future<Result<List<ActivitySearchResultEntity>>> getOrganizationActivities(
    String organizationId,
  ) async {
    // For now, we don't have a dedicated endpoint for organization activities
    return Result.error(
      UnimplementedError(
        'Organization activities endpoint not yet implemented',
      ),
    );
  }
}
