import '../../core/exceptions/app_exceptions.dart';
import '../../core/utils/result.dart';
import '../entities/entities.dart';
import '../repositories/repositories.dart';

/// Use case for getting activity details.
///
/// Retrieves detailed information about a specific activity.
class GetActivityUseCase {
  const GetActivityUseCase(this._repository);

  final ActivityRepository _repository;

  /// Executes the use case to get activity details.
  ///
  /// [activityId] - The ID of the activity to retrieve.
  ///
  /// Returns [ActivitySearchResultEntity] on success.
  Future<Result<ActivitySearchResultEntity>> execute(String activityId) async {
    if (activityId.isEmpty) {
      return Result.error(
        ValidationException.field('Activity ID', 'cannot be empty'),
      );
    }

    return _repository.getActivity(activityId);
  }
}

/// Use case for getting organization details.
class GetOrganizationUseCase {
  const GetOrganizationUseCase(this._repository);

  final OrganizationRepository _repository;

  /// Executes the use case to get organization details.
  ///
  /// [organizationId] - The ID of the organization to retrieve.
  ///
  /// Returns [OrganizationEntity] on success.
  Future<Result<OrganizationEntity>> execute(String organizationId) async {
    if (organizationId.isEmpty) {
      return Result.error(
        ValidationException.field('Organization ID', 'cannot be empty'),
      );
    }

    return _repository.getOrganization(organizationId);
  }
}

/// Use case for getting all activities of an organization.
class GetOrganizationActivitiesUseCase {
  const GetOrganizationActivitiesUseCase(this._repository);

  final OrganizationRepository _repository;

  /// Executes the use case to get organization's activities.
  ///
  /// [organizationId] - The ID of the organization.
  ///
  /// Returns list of activities on success.
  Future<Result<List<ActivitySearchResultEntity>>> execute(
    String organizationId,
  ) async {
    if (organizationId.isEmpty) {
      return Result.error(
        ValidationException.field('Organization ID', 'cannot be empty'),
      );
    }

    return _repository.getOrganizationActivities(organizationId);
  }
}
