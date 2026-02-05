/// Search Feature Module
///
/// This module contains all search-related functionality:
/// - Search screen
/// - Filter widgets
/// - Search state management
/// - Search-specific tokens (if any custom overrides needed)
///
/// ## Module Structure
///
/// ```
/// features/search/
/// ├── search.dart           # Module exports (this file)
/// ├── screens/
/// │   └── search_screen.dart
/// ├── widgets/
/// │   ├── activity_card.dart
/// │   ├── filter_chips.dart
/// │   └── search_filters_sheet.dart
/// └── providers/
///     └── search_provider.dart
/// ```
///
/// ## Usage
///
/// ```dart
/// import 'package:siutindei_app/features/search/search.dart';
///
/// // Navigate to search
/// Navigator.push(context, MaterialPageRoute(
///   builder: (_) => const SearchScreen(),
/// ));
/// ```
library;

// Screens
export 'screens/search_screen.dart';

// Widgets
export 'widgets/activity_card.dart';
export 'widgets/filter_chip_bar.dart';
export 'widgets/search_filters_sheet.dart';
