# Repository Interfaces

Repository interfaces define the contract for data access operations. They live in the domain layer and are implemented in the data layer.

## Overview

Repositories provide:
- Abstraction over data sources (API, cache, database)
- Type-safe contracts using `Result<T>`
- Clean separation between domain and data layers
- Easy testing through mock implementations

## Location

```
lib/domain/repositories/
├── repositories.dart         # Barrel file
└── activity_repository.dart  # Repository interfaces
```

## Design Principles

1. **Interface Only**: No implementation details
2. **Domain Types**: Use entities, not data models
3. **Result Returns**: All async operations return `Result<T>`
4. **Single Responsibility**: Each repository handles one aggregate

## ActivityRepository

Interface for activity-related data operations.

```dart
abstract interface class ActivityRepository {
  /// Searches for activities matching the given filters.
  ///
  /// Returns [SearchResultsEntity] containing matching activities
  /// and pagination cursor.
  Future<Result<SearchResultsEntity>> searchActivities(SearchFilters filters);

  /// Gets a single activity by ID.
  Future<Result<ActivitySearchResultEntity>> getActivity(String activityId);
}
```

### Usage in Use Cases

```dart
class SearchActivitiesUseCase {
  const SearchActivitiesUseCase(this._repository);

  final ActivityRepository _repository;

  Future<Result<SearchResultsEntity>> execute(SearchFilters filters) async {
    // Validate filters
    if (filters.age != null && filters.age! < 0) {
      return Result.error(ArgumentError('Age cannot be negative'));
    }

    // Delegate to repository
    return _repository.searchActivities(filters);
  }
}
```

## OrganizationRepository

Interface for organization-related data operations.

```dart
abstract interface class OrganizationRepository {
  /// Gets an organization by ID.
  Future<Result<OrganizationEntity>> getOrganization(String organizationId);

  /// Gets all activities for an organization.
  Future<Result<List<ActivitySearchResultEntity>>> getOrganizationActivities(
    String organizationId,
  );
}
```

## Why Interfaces?

### 1. Dependency Inversion

Higher layers depend on abstractions:

```
┌─────────────────┐
│    Use Case     │  Depends on ActivityRepository (interface)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │  ActivityRepository (interface)
│   (Interface)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Implementation │  ActivityRepositoryImpl (concrete)
└─────────────────┘
```

### 2. Testability

Mock implementations for testing:

```dart
class MockActivityRepository implements ActivityRepository {
  @override
  Future<Result<SearchResultsEntity>> searchActivities(
    SearchFilters filters,
  ) async {
    return Result.ok(SearchResultsEntity(
      items: [mockActivity1, mockActivity2],
      nextCursor: null,
    ));
  }

  @override
  Future<Result<ActivitySearchResultEntity>> getActivity(
    String activityId,
  ) async {
    return Result.ok(mockActivity1);
  }
}
```

### 3. Flexibility

Swap implementations without changing consumers:

```dart
// Production: Uses API
final activityRepositoryProvider = Provider<ActivityRepository>((ref) {
  return ActivityRepositoryImpl(ref.watch(apiServiceProvider));
});

// Testing: Uses mock
final container = ProviderContainer(
  overrides: [
    activityRepositoryProvider.overrideWithValue(MockActivityRepository()),
  ],
);
```

## Defining New Repositories

Follow this pattern when creating new repository interfaces:

```dart
/// Repository for [EntityName]-related operations.
///
/// This defines the contract for data access. Implementations
/// handle API calls, caching, and data transformation.
abstract interface class EntityNameRepository {
  /// Brief description of what the method does.
  ///
  /// [param1] - Description of parameter.
  /// [param2] - Description of parameter.
  ///
  /// Returns [ReturnType] on success, [Exception] on failure.
  Future<Result<ReturnType>> methodName(ParamType param1, ParamType param2);
}
```

## Repository Method Guidelines

### Return Types

| Scenario | Return Type |
|----------|-------------|
| Single entity | `Result<EntityType>` |
| List of entities | `Result<List<EntityType>>` |
| Paginated list | `Result<PaginatedEntity>` |
| Operation without data | `Result<void>` |

### Error Handling

Repositories should catch exceptions and return `Result.error`:

```dart
// In implementation
@override
Future<Result<SearchResultsEntity>> searchActivities(
  SearchFilters filters,
) async {
  try {
    final response = await _apiService.search(filters);
    return Result.ok(ActivityMapper.toEntity(response));
  } on NetworkException catch (e) {
    return Result.error(e);
  } on FormatException catch (e) {
    return Result.error(e);
  } on Exception catch (e) {
    return Result.error(e);
  }
}
```

### Method Naming

- `getX` - Retrieve single entity
- `getXList` / `getAllX` - Retrieve multiple entities
- `searchX` - Search with filters
- `createX` - Create new entity
- `updateX` - Update existing entity
- `deleteX` - Delete entity

## Implementations

See [Data Layer Repositories](../data/repositories.md) for implementation details.

## Testing

```dart
void main() {
  group('SearchActivitiesUseCase', () {
    late MockActivityRepository mockRepository;
    late SearchActivitiesUseCase useCase;

    setUp(() {
      mockRepository = MockActivityRepository();
      useCase = SearchActivitiesUseCase(mockRepository);
    });

    test('returns results from repository', () async {
      when(mockRepository.searchActivities(any)).thenAnswer(
        (_) async => Result.ok(mockResults),
      );

      final result = await useCase.execute(SearchFilters());

      expect(result.isOk, isTrue);
      verify(mockRepository.searchActivities(any)).called(1);
    });

    test('validates filters before calling repository', () async {
      final result = await useCase.execute(
        SearchFilters(age: -1), // Invalid
      );

      expect(result.isError, isTrue);
      verifyNever(mockRepository.searchActivities(any));
    });
  });
}
```

## Related

- [Entities](entities.md) - Domain objects used in repository methods
- [Use Cases](use_cases.md) - Consumers of repository interfaces
- [Data Repositories](../data/repositories.md) - Concrete implementations
