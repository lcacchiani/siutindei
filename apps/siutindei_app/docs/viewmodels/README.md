# ViewModels

ViewModels manage feature state and coordinate between the UI and domain layer. They use Riverpod's `StateNotifier` pattern for reactive state management.

## Overview

ViewModels:
- Extend `StateNotifier<State>` for reactive state
- Use Use Cases for business logic
- Expose immutable state objects
- Handle async operations with loading/error states
- Are provided via Riverpod providers

## Location

```
lib/viewmodels/
├── activities_viewmodel.dart  # Search feature state
└── auth_viewmodel.dart        # Authentication state
```

## ActivitiesViewModel

Manages state for the activity search feature.

### State Class

```dart
@immutable
class ActivitiesState {
  const ActivitiesState({
    this.results = const SearchResultsEntity(items: []),
    this.filters = SearchFilters.empty,
    this.isLoading = false,
    this.isLoadingMore = false,
    this.errorMessage,
  });

  final SearchResultsEntity results;
  final SearchFilters filters;
  final bool isLoading;
  final bool isLoadingMore;
  final String? errorMessage;

  // Convenience getters
  List<ActivitySearchResultEntity> get items => results.items;
  bool get hasMore => results.hasMore;
  bool get isEmpty => results.isEmpty && !isLoading;
  bool get hasError => errorMessage != null;

  // Immutable update
  ActivitiesState copyWith({
    SearchResultsEntity? results,
    SearchFilters? filters,
    bool? isLoading,
    bool? isLoadingMore,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ActivitiesState(
      results: results ?? this.results,
      filters: filters ?? this.filters,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  static const ActivitiesState initial = ActivitiesState();
}
```

### ViewModel Class

```dart
class ActivitiesViewModel extends StateNotifier<ActivitiesState> {
  ActivitiesViewModel({
    required SearchActivitiesUseCase searchUseCase,
    required LoadMoreActivitiesUseCase loadMoreUseCase,
  })  : _searchUseCase = searchUseCase,
        _loadMoreUseCase = loadMoreUseCase,
        super(ActivitiesState.initial);

  final SearchActivitiesUseCase _searchUseCase;
  final LoadMoreActivitiesUseCase _loadMoreUseCase;

  /// Performs a new search with the given filters.
  Future<void> search(SearchFilters filters) async {
    final searchFilters = filters.withoutCursor();

    state = state.copyWith(
      filters: searchFilters,
      isLoading: true,
      clearError: true,
    );

    final result = await _searchUseCase.execute(searchFilters);

    switch (result) {
      case Ok(value: final data):
        state = state.copyWith(results: data, isLoading: false);
      case Error(error: final e):
        state = state.copyWith(
          isLoading: false,
          errorMessage: _formatError(e),
        );
    }
  }

  /// Loads more results using the current cursor.
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;

    final filtersWithCursor = state.filters.copyWith(
      cursor: state.results.nextCursor,
    );

    state = state.copyWith(isLoadingMore: true, clearError: true);

    final result = await _loadMoreUseCase.execute(
      filtersWithCursor,
      state.results,
    );

    switch (result) {
      case Ok(value: final data):
        state = state.copyWith(results: data, isLoadingMore: false);
      case Error(error: final e):
        state = state.copyWith(
          isLoadingMore: false,
          errorMessage: _formatError(e),
        );
    }
  }

  void updateFilters(SearchFilters filters) {
    state = state.copyWith(filters: filters);
  }

  void clear() {
    state = ActivitiesState.initial;
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  Future<void> retry() async {
    await search(state.filters);
  }

  String _formatError(Exception e) {
    if (e is ArgumentError) {
      return e.message?.toString() ?? 'Invalid input';
    }
    return 'An error occurred. Please try again.';
  }
}
```

### Provider

```dart
final activitiesViewModelProvider =
    StateNotifierProvider<ActivitiesViewModel, ActivitiesState>((ref) {
  return ActivitiesViewModel(
    searchUseCase: ref.watch(searchActivitiesUseCaseProvider),
    loadMoreUseCase: ref.watch(loadMoreActivitiesUseCaseProvider),
  );
});
```

### Selectors

Granular selectors for optimized rebuilds:

```dart
/// Selector for items only
final activitiesItemsProvider = Provider<List<ActivitySearchResultEntity>>((ref) {
  return ref.watch(activitiesViewModelProvider.select((s) => s.items));
});

/// Selector for loading state
final activitiesIsLoadingProvider = Provider<bool>((ref) {
  return ref.watch(activitiesViewModelProvider.select((s) => s.isLoading));
});

/// Selector for error state
final activitiesErrorProvider = Provider<String?>((ref) {
  return ref.watch(activitiesViewModelProvider.select((s) => s.errorMessage));
});

/// Selector for has more state
final activitiesHasMoreProvider = Provider<bool>((ref) {
  return ref.watch(activitiesViewModelProvider.select((s) => s.hasMore));
});

/// Selector for filters
final activitiesFiltersProvider = Provider<SearchFilters>((ref) {
  return ref.watch(activitiesViewModelProvider.select((s) => s.filters));
});
```

## Using ViewModels in UI

### Watching State

```dart
class MyWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Option 1: Watch full state
    final state = ref.watch(activitiesViewModelProvider);

    // Option 2: Watch specific slice (better for performance)
    final items = ref.watch(
      activitiesViewModelProvider.select((s) => s.items),
    );

    // Option 3: Use predefined selectors
    final isLoading = ref.watch(activitiesIsLoadingProvider);

    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) => ActivityCard(result: items[index]),
    );
  }
}
```

### Calling Methods

```dart
// Read notifier for actions (don't watch)
ref.read(activitiesViewModelProvider.notifier).search(filters);

// In event handlers
ElevatedButton(
  onPressed: () {
    ref.read(activitiesViewModelProvider.notifier).retry();
  },
  child: Text('Retry'),
)
```

## ViewModel Design Patterns

### 1. Immutable State

Always use immutable state objects with `copyWith`:

```dart
// Good
state = state.copyWith(isLoading: true);

// Bad - mutating state
state.isLoading = true; // Won't trigger rebuild
```

### 2. Constructor Injection

Inject dependencies through constructor:

```dart
class MyViewModel extends StateNotifier<MyState> {
  MyViewModel({
    required UseCase1 useCase1,
    required UseCase2 useCase2,
  })  : _useCase1 = useCase1,
        _useCase2 = useCase2,
        super(MyState.initial);

  final UseCase1 _useCase1;
  final UseCase2 _useCase2;
}
```

### 3. Result Pattern Handling

Use pattern matching for Result handling:

```dart
final result = await _useCase.execute(params);

switch (result) {
  case Ok(value: final data):
    state = state.copyWith(data: data, isLoading: false);
  case Error(error: final e):
    state = state.copyWith(errorMessage: e.toString(), isLoading: false);
}
```

### 4. Guard Conditions

Prevent invalid operations:

```dart
Future<void> loadMore() async {
  // Guard against invalid state
  if (state.isLoadingMore || !state.hasMore) return;

  // Proceed with operation
  state = state.copyWith(isLoadingMore: true);
  // ...
}
```

### 5. Error Formatting

Format errors for user display:

```dart
String _formatError(Exception e) {
  if (e is NetworkException) {
    return 'Network error. Check your connection.';
  }
  if (e is ArgumentError) {
    return e.message?.toString() ?? 'Invalid input';
  }
  return 'An unexpected error occurred.';
}
```

## Creating New ViewModels

Template for new ViewModels:

```dart
// 1. Define state class
@immutable
class MyFeatureState {
  const MyFeatureState({
    this.data,
    this.isLoading = false,
    this.errorMessage,
  });

  final DataType? data;
  final bool isLoading;
  final String? errorMessage;

  MyFeatureState copyWith({
    DataType? data,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return MyFeatureState(
      data: data ?? this.data,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  static const MyFeatureState initial = MyFeatureState();
}

// 2. Define ViewModel class
class MyFeatureViewModel extends StateNotifier<MyFeatureState> {
  MyFeatureViewModel({required MyUseCase useCase})
      : _useCase = useCase,
        super(MyFeatureState.initial);

  final MyUseCase _useCase;

  Future<void> loadData() async {
    state = state.copyWith(isLoading: true, clearError: true);

    final result = await _useCase.execute();

    switch (result) {
      case Ok(value: final data):
        state = state.copyWith(data: data, isLoading: false);
      case Error(error: final e):
        state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }
}

// 3. Define provider
final myFeatureViewModelProvider =
    StateNotifierProvider<MyFeatureViewModel, MyFeatureState>((ref) {
  return MyFeatureViewModel(
    useCase: ref.watch(myUseCaseProvider),
  );
});
```

## Testing ViewModels

```dart
void main() {
  group('ActivitiesViewModel', () {
    late MockSearchActivitiesUseCase mockSearchUseCase;
    late MockLoadMoreActivitiesUseCase mockLoadMoreUseCase;
    late ActivitiesViewModel viewModel;

    setUp(() {
      mockSearchUseCase = MockSearchActivitiesUseCase();
      mockLoadMoreUseCase = MockLoadMoreActivitiesUseCase();
      viewModel = ActivitiesViewModel(
        searchUseCase: mockSearchUseCase,
        loadMoreUseCase: mockLoadMoreUseCase,
      );
    });

    test('initial state is correct', () {
      expect(viewModel.state.isLoading, isFalse);
      expect(viewModel.state.items, isEmpty);
      expect(viewModel.state.errorMessage, isNull);
    });

    test('search sets loading state', () async {
      when(mockSearchUseCase.execute(any)).thenAnswer(
        (_) async => Result.ok(SearchResultsEntity.empty),
      );

      final future = viewModel.search(SearchFilters());

      expect(viewModel.state.isLoading, isTrue);

      await future;

      expect(viewModel.state.isLoading, isFalse);
    });

    test('search updates results on success', () async {
      final mockResults = SearchResultsEntity(
        items: [mockActivity],
        nextCursor: 'cursor1',
      );

      when(mockSearchUseCase.execute(any)).thenAnswer(
        (_) async => Result.ok(mockResults),
      );

      await viewModel.search(SearchFilters());

      expect(viewModel.state.items.length, equals(1));
      expect(viewModel.state.hasMore, isTrue);
    });

    test('search sets error on failure', () async {
      when(mockSearchUseCase.execute(any)).thenAnswer(
        (_) async => Result.error(Exception('Network error')),
      );

      await viewModel.search(SearchFilters());

      expect(viewModel.state.errorMessage, isNotNull);
      expect(viewModel.state.isLoading, isFalse);
    });

    test('loadMore appends results', () async {
      // Set up initial state with results
      viewModel.state = ActivitiesState(
        results: SearchResultsEntity(
          items: [mockActivity1],
          nextCursor: 'cursor1',
        ),
      );

      when(mockLoadMoreUseCase.execute(any, any)).thenAnswer(
        (_) async => Result.ok(SearchResultsEntity(
          items: [mockActivity1, mockActivity2],
          nextCursor: 'cursor2',
        )),
      );

      await viewModel.loadMore();

      expect(viewModel.state.items.length, equals(2));
    });
  });
}
```

## Related

- [Use Cases](../domain/use_cases.md) - Business logic used by ViewModels
- [Features](../features/README.md) - UI that consumes ViewModels
- [Result Type](../core/result.md) - Error handling in ViewModels
