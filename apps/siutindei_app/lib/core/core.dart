/// Core module - shared functionality across features.
///
/// This module contains:
/// - Base widget classes
/// - Shared UI components
/// - Common utilities
/// - Token-aware building blocks
///
/// ## Architecture
///
/// ```
/// lib/
/// ├── core/                    # Shared across all features
/// │   ├── widgets/             # Base/shared widgets
/// │   └── utils/               # Common utilities
/// ├── features/                # Feature modules
/// │   ├── search/              # Search feature
/// │   ├── activity_detail/     # Activity detail feature
/// │   └── organization/        # Organization feature
/// └── config/                  # Configuration
///     ├── tokens/              # Design tokens
///     └── constants.dart       # Business constants
/// ```
library;

// Base widgets and utilities
export 'widgets/base_avatar.dart';
export 'widgets/base_badge.dart';
export 'widgets/base_card.dart';
export 'widgets/token_aware_widget.dart';
