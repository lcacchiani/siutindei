/// Core module - shared functionality across features.
///
/// This module contains:
/// - Base widget classes
/// - Shared UI components
/// - Common utilities
/// - Token-aware building blocks
/// - Result type for error handling
/// - Command pattern for async operations
///
/// ## Architecture
///
/// Following Flutter's recommended architecture (docs.flutter.dev/app-architecture):
///
/// ```
/// lib/
/// ├── core/                    # Shared across all features
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

// Base widgets
export 'widgets/base_avatar.dart';
export 'widgets/base_badge.dart';
export 'widgets/base_card.dart';
export 'widgets/token_aware_widget.dart';
