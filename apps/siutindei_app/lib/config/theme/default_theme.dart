import 'package:flutter/material.dart';

import 'siutindei_theme.dart';

/// Default/Test theme implementation.
///
/// This is a placeholder design intended for development and testing.
/// It provides a clean, functional UI but is NOT the final brand design.
///
/// ## Purpose
/// - Allows development of features without waiting for final designs
/// - Provides a complete, working UI for testing
/// - Serves as a reference implementation for custom themes
///
/// ## To Replace This Theme
/// 1. Create a new class extending [SiutindeiTheme]
/// 2. Override all design tokens with your brand values
/// 3. Update [ThemeProvider] to use your theme
///
/// Example:
/// ```dart
/// // In theme_provider.dart
/// final themeProvider = Provider<SiutindeiTheme>((ref) {
///   return MyBrandTheme(); // Instead of DefaultTheme()
/// });
/// ```
class DefaultTheme extends SiutindeiTheme {
  const DefaultTheme();

  // ============================================================
  // THEME IDENTITY
  // ============================================================

  @override
  String get themeId => 'default';

  @override
  String get themeName => 'Default (Test Design)';

  // ============================================================
  // COLOR PALETTE
  // These are placeholder colors - replace with brand colors
  // ============================================================

  /// Indigo-based primary color
  @override
  Color get primaryColor => const Color(0xFF6366F1);

  @override
  Color get primaryLight => const Color(0xFF818CF8);

  @override
  Color get primaryDark => const Color(0xFF4F46E5);

  /// Emerald secondary color
  @override
  Color get secondaryColor => const Color(0xFF10B981);

  @override
  Color get secondaryLight => const Color(0xFF34D399);

  /// Light gray background
  @override
  Color get backgroundColor => const Color(0xFFF8FAFC);

  @override
  Color get surfaceColor => Colors.white;

  @override
  Color get cardColor => Colors.white;

  /// Slate text colors
  @override
  Color get textPrimary => const Color(0xFF1E293B);

  @override
  Color get textSecondary => const Color(0xFF64748B);

  @override
  Color get textTertiary => const Color(0xFF94A3B8);

  /// Status colors
  @override
  Color get errorColor => const Color(0xFFEF4444);

  @override
  Color get successColor => const Color(0xFF22C55E);

  @override
  Color get warningColor => const Color(0xFFF59E0B);

  @override
  Color get borderColor => const Color(0xFFE2E8F0);

  // ============================================================
  // SPACING - Based on 4px grid
  // ============================================================

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

  // ============================================================
  // BORDER RADIUS
  // ============================================================

  @override
  double get radiusSm => 8;

  @override
  double get radiusMd => 12;

  @override
  double get radiusLg => 16;

  @override
  double get radiusXl => 24;

  // ============================================================
  // TYPOGRAPHY
  // Using system fonts - replace with brand fonts
  // ============================================================

  @override
  TextStyle get headlineStyle => TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.bold,
        color: textPrimary,
        height: 1.3,
      );

  @override
  TextStyle get titleStyle => TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: textPrimary,
        height: 1.4,
      );

  @override
  TextStyle get bodyStyle => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.normal,
        color: textSecondary,
        height: 1.5,
      );

  @override
  TextStyle get captionStyle => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.normal,
        color: textTertiary,
        height: 1.4,
      );

  @override
  TextStyle get labelStyle => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: textSecondary,
      );

  // ============================================================
  // COMPONENT STYLES
  // ============================================================

  @override
  ButtonStyle get elevatedButtonStyle => ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        padding: EdgeInsets.symmetric(
          horizontal: spacingLg,
          vertical: spacingMd,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        elevation: 0,
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      );

  @override
  ButtonStyle get outlinedButtonStyle => OutlinedButton.styleFrom(
        foregroundColor: primaryColor,
        padding: EdgeInsets.symmetric(
          horizontal: spacingLg,
          vertical: spacingMd,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
        ),
        side: BorderSide(color: primaryColor),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
        ),
      );

  @override
  ButtonStyle get textButtonStyle => TextButton.styleFrom(
        foregroundColor: primaryColor,
        padding: EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: spacingSm,
        ),
        textStyle: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
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
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: BorderSide(color: errorColor),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: spacingMd,
        ),
        hintStyle: TextStyle(color: textTertiary),
        labelStyle: TextStyle(color: textSecondary),
      );

  @override
  CardTheme get cardTheme => CardTheme(
        color: cardColor,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: BorderSide(color: borderColor),
        ),
      );

  @override
  ChipThemeData get chipTheme => ChipThemeData(
        backgroundColor: backgroundColor,
        selectedColor: primaryColor.withValues(alpha: 0.15),
        labelStyle: TextStyle(fontSize: 14, color: textSecondary),
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
        iconTheme: IconThemeData(color: textPrimary),
      );

  @override
  BottomSheetThemeData get bottomSheetTheme => BottomSheetThemeData(
        backgroundColor: surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(radiusXl),
          ),
        ),
        clipBehavior: Clip.antiAlias,
      );

  @override
  DividerThemeData get dividerTheme => DividerThemeData(
        color: borderColor,
        thickness: 1,
        space: 1,
      );
}
