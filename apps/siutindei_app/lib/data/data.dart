/// Data layer - repository implementations and data services.
///
/// This layer handles all data access, including API calls, caching,
/// and transformation between data models and domain entities.
///
/// ## Structure
///
/// - **repositories/**: Repository implementations
/// - **mappers/**: Data transformation utilities
/// - **services/**: Data services (moved from services/)
///
/// ## Architecture Guidelines
///
/// 1. Repository implementations handle API calls and caching
/// 2. Mappers transform between API models and domain entities
/// 3. All operations return `Result<T>` for type-safe error handling
/// 4. Use dependency injection for testability
///
/// See: https://docs.flutter.dev/app-architecture/guide
library;

export 'mappers/activity_mapper.dart';
export 'repositories/activity_repository_impl.dart';
