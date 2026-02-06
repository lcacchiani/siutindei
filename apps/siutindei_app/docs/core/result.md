# Result Type

The `Result<T>` type provides type-safe error handling for asynchronous operations, replacing try-catch blocks with explicit success/failure types.

## Overview

`Result<T>` is a sealed class with two variants:
- `Ok<T>` - Contains a successful value
- `Error<T>` - Contains an exception

## Location

```
lib/core/utils/result.dart
```

## Basic Usage

### Creating Results

```dart
// Success
final success = Result.ok(data);

// Failure
final failure = Result.error(Exception('Something went wrong'));
```

### Pattern Matching (Dart 3)

```dart
final result = await repository.searchActivities(filters);

switch (result) {
  case Ok(value: final data):
    // Handle success
    print('Found ${data.items.length} activities');
  case Error(error: final e):
    // Handle error
    print('Error: $e');
}
```

### Convenience Methods

```dart
// Get value or null
final data = result.valueOrNull;

// Get error or null
final error = result.errorOrNull;

// Get value or throw
final data = result.valueOrThrow; // Throws if error

// Check state
if (result.isOk) { ... }
if (result.isError) { ... }
```

## Transformation

### map

Transform the value if successful:

```dart
final result = Result.ok(42);
final doubled = result.map((value) => value * 2);
// Ok(84)
```

### flatMap

Chain operations that return Results:

```dart
Result<User> getUser(int id) { ... }
Result<Profile> getProfile(User user) { ... }

final result = getUser(1).flatMap(getProfile);
```

### Callbacks

Execute side effects:

```dart
result
  .onOk((data) => print('Success: $data'))
  .onError((e) => print('Error: $e'));
```

## Extension Methods

### Converting Nullable to Result

```dart
final value = someNullableValue;
final result = value.toResult(Exception('Value was null'));
```

### Converting Future to Result

```dart
final future = api.fetchData();
final result = await future.toResult();
// Catches any exception and wraps in Error
```

## Use in Repository Pattern

```dart
abstract interface class ActivityRepository {
  Future<Result<SearchResultsEntity>> searchActivities(SearchFilters filters);
}

class ActivityRepositoryImpl implements ActivityRepository {
  @override
  Future<Result<SearchResultsEntity>> searchActivities(
    SearchFilters filters,
  ) async {
    try {
      final response = await _apiService.searchActivities(filters);
      return Result.ok(ActivityMapper.toEntity(response));
    } on Exception catch (e) {
      return Result.error(e);
    }
  }
}
```

## Use in Use Cases

```dart
class SearchActivitiesUseCase {
  Future<Result<SearchResultsEntity>> execute(SearchFilters filters) async {
    // Validate input
    if (filters.age != null && filters.age! < 0) {
      return Result.error(ArgumentError('Age cannot be negative'));
    }
    
    // Delegate to repository
    return _repository.searchActivities(filters);
  }
}
```

## Use in ViewModels

```dart
Future<void> search(SearchFilters filters) async {
  state = state.copyWith(isLoading: true);
  
  final result = await _searchUseCase.execute(filters);
  
  switch (result) {
    case Ok(value: final data):
      state = state.copyWith(results: data, isLoading: false);
    case Error(error: final e):
      state = state.copyWith(errorMessage: e.toString(), isLoading: false);
  }
}
```

## Best Practices

1. **Always handle both cases**: Don't ignore the Error case
2. **Use pattern matching**: Preferred over `isOk`/`isError` checks
3. **Preserve error context**: Include meaningful error messages
4. **Chain operations**: Use `map` and `flatMap` for composition
5. **Convert at boundaries**: Use `toResult()` when calling external APIs

## Testing

```dart
test('returns Ok on successful search', () async {
  when(mockApi.search(any)).thenAnswer((_) async => mockResponse);
  
  final result = await repository.searchActivities(filters);
  
  expect(result.isOk, isTrue);
  expect(result.valueOrNull?.items.length, equals(2));
});

test('returns Error on API failure', () async {
  when(mockApi.search(any)).thenThrow(Exception('Network error'));
  
  final result = await repository.searchActivities(filters);
  
  expect(result.isError, isTrue);
  expect(result.errorOrNull?.toString(), contains('Network error'));
});
```

## Related

- [Command Pattern](command.md) - Uses Result for async operation state
- [Use Cases](../domain/use_cases.md) - Primary consumers of Result
- [ViewModels](../viewmodels/README.md) - Handle Result in UI state
