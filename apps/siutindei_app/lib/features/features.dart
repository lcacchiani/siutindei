/// Features module - all feature exports.
///
/// ## App Architecture
///
/// ```
/// lib/
/// ├── config/
/// │   ├── tokens/          # Design token system
/// │   └── constants.dart   # Business constants
/// ├── core/                # Shared widgets & utilities
/// ├── features/            # Feature modules (this)
/// │   ├── search/          # Search & browse activities
/// │   ├── activity_detail/ # Activity detail view
/// │   ├── organization/    # Organization profile
/// │   └── auth/            # Authentication
/// ├── models/              # Data models
/// ├── services/            # API & external services
/// └── viewmodels/          # State management
/// ```
library;

export 'activity_detail/activity_detail.dart';
export 'auth/auth.dart';
export 'organization/organization.dart';
export 'search/search.dart';
