import 'package:flutter/material.dart';

/// Abstract theme interface defining all design tokens for the app.
///
/// This interface defines the contract for all visual styling in the app.
/// To create a custom design, implement this class and provide your own
/// values for colors, typography, spacing, and component styles.
///
/// ## Design vs Functionality Separation
///
/// This architecture separates:
/// - **Design (this file)**: Colors, typography, spacing, shadows, borders
/// - **Functionality (constants.dart)**: Business logic constants like
///   language codes, district names, API parameters
///
/// ## How to Create a Custom Theme
///
/// 1. Create a new class that extends [SiutindeiTheme]
/// 2. Override all abstract getters with your design values
/// 3. Register your theme in [ThemeProvider]
///
/// Example:
/// ```dart
/// class MyBrandTheme extends SiutindeiTheme {
///   @override
///   Color get primaryColor => Color(0xFF123456);
///   // ... override all other properties
/// }
/// ```
abstract class SiutindeiTheme {
  const SiutindeiTheme();

  /// Theme identifier for debugging and analytics
  String get themeId;

  /// Human-readable theme name
  String get themeName;

  // ============================================================
  // COLOR PALETTE
  // ============================================================

  /// Primary brand color used for main actions and highlights
  Color get primaryColor;

  /// Lighter variant of primary color for hover/pressed states
  Color get primaryLight;

  /// Darker variant of primary color for emphasis
  Color get primaryDark;

  /// Secondary/accent color for complementary elements
  Color get secondaryColor;

  /// Lighter variant of secondary color
  Color get secondaryLight;

  /// Main background color for scaffolds
  Color get backgroundColor;

  /// Surface color for cards, dialogs, sheets
  Color get surfaceColor;

  /// Card background color
  Color get cardColor;

  /// Primary text color for headings and important text
  Color get textPrimary;

  /// Secondary text color for body text and descriptions
  Color get textSecondary;

  /// Tertiary text color for hints, placeholders, captions
  Color get textTertiary;

  /// Error/danger color for validation and alerts
  Color get errorColor;

  /// Success color for confirmations
  Color get successColor;

  /// Warning color for cautions
  Color get warningColor;

  /// Border color for dividers and outlines
  Color get borderColor;

  // ============================================================
  // SPACING
  // ============================================================

  /// Extra small spacing (e.g., 4px)
  double get spacingXs;

  /// Small spacing (e.g., 8px)
  double get spacingSm;

  /// Medium spacing (e.g., 16px) - default padding
  double get spacingMd;

  /// Large spacing (e.g., 24px)
  double get spacingLg;

  /// Extra large spacing (e.g., 32px)
  double get spacingXl;

  // ============================================================
  // BORDER RADIUS
  // ============================================================

  /// Small border radius (e.g., 8px) - for chips, tags
  double get radiusSm;

  /// Medium border radius (e.g., 12px) - for cards, inputs
  double get radiusMd;

  /// Large border radius (e.g., 16px) - for modals
  double get radiusLg;

  /// Extra large border radius (e.g., 24px) - for bottom sheets
  double get radiusXl;

  // ============================================================
  // TYPOGRAPHY
  // ============================================================

  /// Headline text style for screen titles
  TextStyle get headlineStyle;

  /// Title text style for section headers
  TextStyle get titleStyle;

  /// Body text style for main content
  TextStyle get bodyStyle;

  /// Caption text style for small labels
  TextStyle get captionStyle;

  /// Label text style for form labels
  TextStyle get labelStyle;

  // ============================================================
  // COMPONENT STYLES
  // ============================================================

  /// Style for elevated buttons
  ButtonStyle get elevatedButtonStyle;

  /// Style for outlined buttons
  ButtonStyle get outlinedButtonStyle;

  /// Style for text buttons
  ButtonStyle get textButtonStyle;

  /// Decoration for input fields
  InputDecorationTheme get inputDecorationTheme;

  /// Style for cards
  CardTheme get cardTheme;

  /// Style for chips
  ChipThemeData get chipTheme;

  /// Style for app bars
  AppBarTheme get appBarTheme;

  /// Style for bottom sheets
  BottomSheetThemeData get bottomSheetTheme;

  /// Style for dividers
  DividerThemeData get dividerTheme;

  // ============================================================
  // GENERATED THEME DATA
  // ============================================================

  /// Generates a complete [ThemeData] from this theme's tokens.
  ///
  /// Override this method if you need custom theme data generation.
  ThemeData toThemeData() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        brightness: Brightness.light,
        primary: primaryColor,
        secondary: secondaryColor,
        surface: surfaceColor,
        error: errorColor,
      ),
      scaffoldBackgroundColor: backgroundColor,
      appBarTheme: appBarTheme,
      cardTheme: cardTheme,
      inputDecorationTheme: inputDecorationTheme,
      chipTheme: chipTheme,
      elevatedButtonTheme: ElevatedButtonThemeData(style: elevatedButtonStyle),
      outlinedButtonTheme: OutlinedButtonThemeData(style: outlinedButtonStyle),
      textButtonTheme: TextButtonThemeData(style: textButtonStyle),
      bottomSheetTheme: bottomSheetTheme,
      dividerTheme: dividerTheme,
    );
  }
}

/// Extension to provide convenient access to theme tokens from BuildContext.
extension SiutindeiThemeExtension on BuildContext {
  /// Access the current [SiutindeiTheme] from context.
  ///
  /// Usage:
  /// ```dart
  /// final theme = context.siutindeiTheme;
  /// Container(color: theme.primaryColor);
  /// ```
  SiutindeiTheme get siutindeiTheme {
    // This will be provided by ThemeProvider
    // For now, return DefaultTheme as fallback
    return _currentTheme ?? const _FallbackTheme();
  }
}

// Global theme reference (set by ThemeProvider)
SiutindeiTheme? _currentTheme;

/// Sets the current theme globally. Called by ThemeProvider.
void setCurrentTheme(SiutindeiTheme theme) {
  _currentTheme = theme;
}

/// Minimal fallback theme to prevent null errors.
/// Should never be used in practice.
class _FallbackTheme extends SiutindeiTheme {
  const _FallbackTheme();

  @override
  String get themeId => 'fallback';
  @override
  String get themeName => 'Fallback';

  @override
  Color get primaryColor => const Color(0xFF6366F1);
  @override
  Color get primaryLight => const Color(0xFF818CF8);
  @override
  Color get primaryDark => const Color(0xFF4F46E5);
  @override
  Color get secondaryColor => const Color(0xFF10B981);
  @override
  Color get secondaryLight => const Color(0xFF34D399);
  @override
  Color get backgroundColor => const Color(0xFFF8FAFC);
  @override
  Color get surfaceColor => Colors.white;
  @override
  Color get cardColor => Colors.white;
  @override
  Color get textPrimary => const Color(0xFF1E293B);
  @override
  Color get textSecondary => const Color(0xFF64748B);
  @override
  Color get textTertiary => const Color(0xFF94A3B8);
  @override
  Color get errorColor => const Color(0xFFEF4444);
  @override
  Color get successColor => const Color(0xFF22C55E);
  @override
  Color get warningColor => const Color(0xFFF59E0B);
  @override
  Color get borderColor => const Color(0xFFE2E8F0);

  @override
  double get spacingXs => 4;
  @override
  double get spacingSm => 8;
  @override
  double get spacingMd => 16;
  @override
  double get spacingLg => 24;
  @override
  double get spacingXl => 32;

  @override
  double get radiusSm => 8;
  @override
  double get radiusMd => 12;
  @override
  double get radiusLg => 16;
  @override
  double get radiusXl => 24;

  @override
  TextStyle get headlineStyle => const TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: Color(0xFF1E293B),
      );

  @override
  TextStyle get titleStyle => const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: Color(0xFF1E293B),
      );

  @override
  TextStyle get bodyStyle => const TextStyle(
        fontSize: 14,
        color: Color(0xFF64748B),
      );

  @override
  TextStyle get captionStyle => const TextStyle(
        fontSize: 12,
        color: Color(0xFF94A3B8),
      );

  @override
  TextStyle get labelStyle => const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: Color(0xFF64748B),
      );

  @override
  ButtonStyle get elevatedButtonStyle => ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        padding: EdgeInsets.symmetric(horizontal: spacingLg, vertical: spacingMd),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        elevation: 0,
      );

  @override
  ButtonStyle get outlinedButtonStyle => OutlinedButton.styleFrom(
        foregroundColor: primaryColor,
        padding: EdgeInsets.symmetric(horizontal: spacingLg, vertical: spacingMd),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        side: BorderSide(color: primaryColor),
      );

  @override
  ButtonStyle get textButtonStyle => TextButton.styleFrom(
        foregroundColor: primaryColor,
        padding: EdgeInsets.symmetric(horizontal: spacingMd, vertical: spacingSm),
      );

  @override
  InputDecorationTheme get inputDecorationTheme => InputDecorationTheme(
        filled: true,
        fillColor: backgroundColor,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: EdgeInsets.symmetric(horizontal: spacingMd, vertical: spacingMd),
        hintStyle: TextStyle(color: textTertiary),
        labelStyle: TextStyle(color: textSecondary),
      );

  @override
  CardTheme get cardTheme => CardTheme(
        color: cardColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: BorderSide(color: borderColor),
        ),
      );

  @override
  ChipThemeData get chipTheme => ChipThemeData(
        backgroundColor: backgroundColor,
        selectedColor: primaryColor.withValues(alpha: 0.15),
        labelStyle: const TextStyle(fontSize: 14),
        padding: EdgeInsets.symmetric(horizontal: spacingSm),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          side: BorderSide(color: borderColor),
        ),
      );

  @override
  AppBarTheme get appBarTheme => AppBarTheme(
        backgroundColor: surfaceColor,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
      );

  @override
  BottomSheetThemeData get bottomSheetTheme => BottomSheetThemeData(
        backgroundColor: surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(radiusXl)),
        ),
      );

  @override
  DividerThemeData get dividerTheme => DividerThemeData(
        color: borderColor,
        thickness: 1,
        space: 1,
      );
}
