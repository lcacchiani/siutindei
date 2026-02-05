import '../../core/utils/result.dart';
import '../entities/entities.dart';
import '../repositories/repositories.dart';

/// Use case for searching activities.
///
/// Encapsulates the business logic for activity search, including
/// validation and any domain-specific rules.
///
/// ## Usage
///
/// ```dart
/// final useCase = SearchActivitiesUseCase(repository);
/// final result = await useCase.execute(filters);
/// ```
class SearchActivitiesUseCase {
  const SearchActivitiesUseCase(this._repository);

  final ActivityRepository _repository;

  /// Executes the activity search.
  ///
  /// Validates filters before performing the search.
  /// Returns [SearchResultsEntity] on success.
  Future<Result<SearchResultsEntity>> execute(SearchFilters filters) async {
    // Validate filters
    final validationError = _validateFilters(filters);
    if (validationError != null) {
      return Result.error(validationError);
    }

    return _repository.searchActivities(filters);
  }

  /// Validates search filters.
  Exception? _validateFilters(SearchFilters filters) {
    // Age validation
    if (filters.age != null && (filters.age! < 0 || filters.age! > 100)) {
      return ArgumentError('Age must be between 0 and 100');
    }

    // Price validation
    if (filters.priceMin != null && filters.priceMin! < 0) {
      return ArgumentError('Minimum price cannot be negative');
    }
    if (filters.priceMax != null && filters.priceMax! < 0) {
      return ArgumentError('Maximum price cannot be negative');
    }
    if (filters.priceMin != null &&
        filters.priceMax != null &&
        filters.priceMin! > filters.priceMax!) {
      return ArgumentError('Minimum price cannot exceed maximum price');
    }

    // Time validation
    if (filters.startMinutesUtc != null &&
        (filters.startMinutesUtc! < 0 || filters.startMinutesUtc! > 1440)) {
      return ArgumentError('Start time must be between 0 and 1440 minutes');
    }
    if (filters.endMinutesUtc != null &&
        (filters.endMinutesUtc! < 0 || filters.endMinutesUtc! > 1440)) {
      return ArgumentError('End time must be between 0 and 1440 minutes');
    }

    // Day of week validation
    if (filters.dayOfWeekUtc != null &&
        (filters.dayOfWeekUtc! < 0 || filters.dayOfWeekUtc! > 6)) {
      return ArgumentError('Day of week must be between 0 (Monday) and 6 (Sunday)');
    }

    // Day of month validation
    if (filters.dayOfMonth != null &&
        (filters.dayOfMonth! < 1 || filters.dayOfMonth! > 31)) {
      return ArgumentError('Day of month must be between 1 and 31');
    }

    // Limit validation
    if (filters.limit < 1 || filters.limit > 100) {
      return ArgumentError('Limit must be between 1 and 100');
    }

    return null;
  }
}

/// Use case for loading more search results (pagination).
class LoadMoreActivitiesUseCase {
  const LoadMoreActivitiesUseCase(this._repository);

  final ActivityRepository _repository;

  /// Loads the next page of results.
  ///
  /// [currentFilters] - The filters with the cursor for the next page.
  /// [existingResults] - The current results to append to.
  ///
  /// Returns combined results on success.
  Future<Result<SearchResultsEntity>> execute(
    SearchFilters currentFilters,
    SearchResultsEntity existingResults,
  ) async {
    if (currentFilters.cursor == null) {
      return Result.error(StateError('No more results to load'));
    }

    final result = await _repository.searchActivities(currentFilters);

    return result.map((newResults) => SearchResultsEntity(
          items: [...existingResults.items, ...newResults.items],
          nextCursor: newResults.nextCursor,
        ));
  }
}
