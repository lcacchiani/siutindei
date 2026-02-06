/// Core module - shared functionality across features.
///
/// This module contains:
/// - Base widget classes
/// - Shared UI components
/// - Common utilities
/// - Token-aware building blocks
/// - Result type for error handling
/// - Command pattern for async operations
/// - Custom exception types
/// - Caching for offline-first support
///
/// ## Architecture
///
/// Following Flutter's recommended architecture:
/// - https://docs.flutter.dev/app-architecture/guide
/// - https://docs.flutter.dev/app-architecture/recommendations
///
/// ```
/// lib/
/// ├── core/                    # Shared across all features
/// │   ├── cache/               # Caching utilities
/// │   ├── exceptions/          # Custom exception types
/// │   ├── utils/               # Result, Command patterns
/// │   └── widgets/             # Base/shared widgets
/// ├── data/                    # Data layer
/// │   ├── repositories/        # Repository implementations
/// │   └── services/            # Data services
/// ├── domain/                  # Domain layer
/// │   ├── entities/            # Business entities
/// │   ├── repositories/        # Repository interfaces
/// │   └── use_cases/           # Business logic
/// ├── features/                # Presentation layer
/// │   ├── search/              # Search feature
/// │   ├── activity_detail/     # Activity detail feature
/// │   └── organization/        # Organization feature
/// └── config/                  # Configuration
///     ├── tokens/              # Design tokens
///     └── constants.dart       # Business constants
/// ```
library;

// Core utilities - Result and Command patterns
export 'utils/utils.dart';

// Caching for offline-first support
export 'cache/cache.dart';

// Custom exception types
export 'exceptions/exceptions.dart';

// Dependency injection
export 'di/di.dart';

// Base widgets
export 'widgets/base_avatar.dart';
export 'widgets/base_badge.dart';
export 'widgets/base_card.dart';
export 'widgets/token_aware_widget.dart';
