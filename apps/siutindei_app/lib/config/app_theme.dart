/// Legacy app theme - redirects to new theme system.
///
/// ## MIGRATION NOTICE
///
/// This file provides backward compatibility with the old theming approach.
/// New code should import from the new theme system:
///
/// ```dart
/// // For theme access
/// import 'package:siutindei_app/config/theme/theme.dart';
///
/// // For constants (functional data)
/// import 'package:siutindei_app/config/constants.dart';
/// ```
///
/// ## Design vs Functionality Separation
///
/// The new architecture separates:
/// - **Design** (theme/): Colors, typography, spacing, component styles
/// - **Functionality** (constants.dart): Languages, districts, business logic
///
/// This allows you to completely redesign the app's appearance by swapping
/// the theme without touching any business logic.
library;

// Re-export theme system for backward compatibility
export 'theme/theme.dart';
export 'constants.dart';

// Provide AppTheme as an alias to DefaultTheme for migration
import 'theme/default_theme.dart';

/// @Deprecated('Use SiutindeiTheme from theme/theme.dart instead')
/// Legacy AppTheme class for backward compatibility.
///
/// This class wraps DefaultTheme values as static constants.
/// Migrate to using the theme provider instead:
/// ```dart
/// // Old way (deprecated)
/// Container(color: AppTheme.primaryColor)
///
/// // New way (recommended)
/// final theme = ref.watch(themeProvider);
/// Container(color: theme.primaryColor)
/// ```
class AppTheme {
  AppTheme._();

  static const _theme = DefaultTheme();

  // Colors - delegating to DefaultTheme
  static Color get primaryColor => _theme.primaryColor;
  static Color get primaryLight => _theme.primaryLight;
  static Color get primaryDark => _theme.primaryDark;
  static Color get secondaryColor => _theme.secondaryColor;
  static Color get secondaryLight => _theme.secondaryLight;
  static Color get backgroundLight => _theme.backgroundColor;
  static Color get surfaceColor => _theme.surfaceColor;
  static Color get cardColor => _theme.cardColor;
  static Color get textPrimary => _theme.textPrimary;
  static Color get textSecondary => _theme.textSecondary;
  static Color get textTertiary => _theme.textTertiary;
  static Color get errorColor => _theme.errorColor;
  static Color get successColor => _theme.successColor;
  static Color get warningColor => _theme.warningColor;
  static Color get borderColor => _theme.borderColor;

  // Spacing
  static double get spacingXs => _theme.spacingXs;
  static double get spacingSm => _theme.spacingSm;
  static double get spacingMd => _theme.spacingMd;
  static double get spacingLg => _theme.spacingLg;
  static double get spacingXl => _theme.spacingXl;

  // Border radius
  static double get radiusSm => _theme.radiusSm;
  static double get radiusMd => _theme.radiusMd;
  static double get radiusLg => _theme.radiusLg;
  static double get radiusXl => _theme.radiusXl;

  /// Get the light theme data.
  /// @Deprecated('Use ref.watch(themeDataProvider) instead')
  static get lightTheme => _theme.toThemeData();
}
