/// Caching utilities for offline-first support.
///
/// Implements the recommended caching strategy from Flutter architecture:
/// - Cache as single source of truth for data
/// - Stale-while-revalidate pattern
/// - Configurable cache policies
library;

export 'cache_manager.dart';
