# Cache Manager

The `CacheManager` provides offline-first caching following Flutter architecture recommendations.

## Overview

Features:
- In-memory caching with configurable policies
- Stale-while-revalidate pattern for better UX
- Automatic cache expiration
- Request deduplication

## Location

```
lib/core/cache/
├── cache.dart           # Barrel file
└── cache_manager.dart   # Cache implementation
```

## Cache Policies

```dart
class CachePolicy {
  final Duration maxAge;
  final bool staleWhileRevalidate;
  final bool persistToDisk;

  // Presets
  static const api = CachePolicy(
    maxAge: Duration(minutes: 5),
    staleWhileRevalidate: true,
  );

  static const longLived = CachePolicy(
    maxAge: Duration(hours: 1),
    staleWhileRevalidate: true,
  );

  static const none = CachePolicy(
    maxAge: Duration.zero,
    staleWhileRevalidate: false,
  );
}
```

## Usage

### Basic Caching

```dart
final cache = CacheManager.instance;

// Set a value
cache.set('key', myData, policy: CachePolicy.api);

// Get a value (returns null if expired/missing)
final data = cache.get<MyData>('key');
```

### Fetch with Cache

```dart
final result = await cache.getOrFetch<SearchResultsEntity>(
  key: 'search_results_${filters.hashCode}',
  policy: CachePolicy.api,
  fetch: () => repository.searchFromApi(filters),
);
```

### Stale-While-Revalidate

When cache is stale but `staleWhileRevalidate` is true:
1. Returns stale data immediately
2. Triggers background refresh
3. Next request gets fresh data

```dart
// First call - returns stale data, refreshes in background
final result1 = await cache.getOrFetch(...); // Immediate response

// Later call - returns fresh data from background refresh
final result2 = await cache.getOrFetch(...); // Fresh data
```

### Cache Invalidation

```dart
// Invalidate specific key
cache.invalidate('search_results_123');

// Invalidate by prefix
cache.invalidatePrefix('search_results_');

// Clear all
cache.clear();
```

## Cache Keys

Use `CacheKeys` for consistent key generation:

```dart
CacheKeys.searchResults(filtersHash)  // 'search_results_{hash}'
CacheKeys.activityDetail(activityId)  // 'activity_detail_{id}'
CacheKeys.organization(orgId)         // 'organization_{id}'
```

## In Repositories

```dart
class ActivityRepositoryImpl implements ActivityRepository {
  ActivityRepositoryImpl(this._apiService, {CacheManager? cacheManager})
      : _cache = cacheManager ?? CacheManager.instance;

  final CacheManager _cache;

  @override
  Future<Result<SearchResultsEntity>> searchActivities(
    SearchFilters filters,
  ) async {
    final cacheKey = CacheKeys.searchResults(filters.hashCode.toString());

    return _cache.getOrFetch<SearchResultsEntity>(
      key: cacheKey,
      policy: CachePolicy.api,
      fetch: () => _fetchSearchResults(filters),
    );
  }
}
```

## Testing

```dart
test('returns cached data when available', () async {
  final cache = CacheManager.instance;
  cache.set('test_key', testData);

  final result = await cache.getOrFetch<TestData>(
    key: 'test_key',
    fetch: () async => Result.ok(newData),
  );

  expect(result.valueOrNull, equals(testData)); // Returns cached, not fetched
});

test('fetches when cache is empty', () async {
  final cache = CacheManager.instance;
  cache.clear();

  var fetchCalled = false;
  final result = await cache.getOrFetch<TestData>(
    key: 'test_key',
    fetch: () async {
      fetchCalled = true;
      return Result.ok(testData);
    },
  );

  expect(fetchCalled, isTrue);
  expect(result.valueOrNull, equals(testData));
});
```

## Related

- [Repositories](../data/repositories.md) - Cache usage in repositories
- [Architecture Recommendations](../architecture-recommendations.md) - Offline-first pattern
