import 'package:flutter/material.dart';

/// App theme configuration for consistent styling across the app.
class AppTheme {
  AppTheme._();

  // Primary colors
  static const Color primaryColor = Color(0xFF6366F1);
  static const Color primaryLight = Color(0xFF818CF8);
  static const Color primaryDark = Color(0xFF4F46E5);

  // Secondary colors
  static const Color secondaryColor = Color(0xFF10B981);
  static const Color secondaryLight = Color(0xFF34D399);

  // Background colors
  static const Color backgroundLight = Color(0xFFF8FAFC);
  static const Color surfaceColor = Colors.white;
  static const Color cardColor = Colors.white;

  // Text colors
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textTertiary = Color(0xFF94A3B8);

  // Status colors
  static const Color errorColor = Color(0xFFEF4444);
  static const Color successColor = Color(0xFF22C55E);
  static const Color warningColor = Color(0xFFF59E0B);

  // Border colors
  static const Color borderColor = Color(0xFFE2E8F0);

  // Spacing
  static const double spacingXs = 4;
  static const double spacingSm = 8;
  static const double spacingMd = 16;
  static const double spacingLg = 24;
  static const double spacingXl = 32;

  // Border radius
  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusXl = 24;

  /// Light theme configuration
  static ThemeData get lightTheme {
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
      scaffoldBackgroundColor: backgroundLight,
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceColor,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: textPrimary,
        ),
      ),
      cardTheme: CardTheme(
        color: cardColor,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: const BorderSide(color: borderColor),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: backgroundLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: spacingMd,
          vertical: spacingMd,
        ),
        hintStyle: const TextStyle(color: textTertiary),
        labelStyle: const TextStyle(color: textSecondary),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: backgroundLight,
        selectedColor: primaryColor.withValues(alpha: 0.15),
        labelStyle: const TextStyle(fontSize: 14),
        padding: const EdgeInsets.symmetric(horizontal: spacingSm),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          side: const BorderSide(color: borderColor),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
          side: const BorderSide(color: primaryColor),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(
            horizontal: spacingMd,
            vertical: spacingSm,
          ),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surfaceColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(radiusXl),
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: borderColor,
        thickness: 1,
        space: 1,
      ),
    );
  }
}

/// App-wide constants for filter options.
class AppConstants {
  AppConstants._();

  /// Supported language codes and their display names.
  static const Map<String, String> languageOptions = {
    'en': 'English',
    'zh': '中文',
    'ja': '日本語',
    'ko': '한국어',
    'fr': 'Français',
    'de': 'Deutsch',
    'es': 'Español',
    'pt': 'Português',
    'it': 'Italiano',
    'ru': 'Русский',
    'ar': 'العربية',
    'hi': 'हिन्दी',
    'th': 'ไทย',
    'vi': 'Tiếng Việt',
    'id': 'Bahasa Indonesia',
    'ms': 'Bahasa Melayu',
    'tl': 'Filipino',
    'nl': 'Nederlands',
    'pl': 'Polski',
    'tr': 'Türkçe',
    'yue': '廣東話',
  };

  /// Days of the week (0 = Sunday).
  static const List<String> daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  /// Short form days of the week.
  static const List<String> daysOfWeekShort = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ];

  /// Pricing types with display names.
  static const Map<String, String> pricingTypes = {
    'per_class': 'Per Class',
    'per_month': 'Monthly',
    'per_sessions': 'Per Sessions',
  };

  /// Schedule types with display names.
  static const Map<String, String> scheduleTypes = {
    'weekly': 'Weekly',
    'monthly': 'Monthly',
    'date_specific': 'One-time',
  };

  /// Common districts (can be expanded based on actual data).
  static const List<String> districts = [
    'Central',
    'Wan Chai',
    'Eastern',
    'Southern',
    'Yau Tsim Mong',
    'Sham Shui Po',
    'Kowloon City',
    'Wong Tai Sin',
    'Kwun Tong',
    'Tsuen Wan',
    'Tuen Mun',
    'Yuen Long',
    'North',
    'Tai Po',
    'Sha Tin',
    'Sai Kung',
    'Islands',
    'Kwai Tsing',
  ];

  /// Converts minutes from midnight to a readable time string.
  static String minutesToTimeString(int minutes) {
    final hours = minutes ~/ 60;
    final mins = minutes % 60;
    final period = hours >= 12 ? 'PM' : 'AM';
    final displayHours = hours == 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    return '${displayHours.toString().padLeft(2, '0')}:${mins.toString().padLeft(2, '0')} $period';
  }

  /// Converts a TimeOfDay to minutes from midnight.
  static int timeOfDayToMinutes(int hour, int minute) {
    return hour * 60 + minute;
  }

  /// Age range presets for quick filtering.
  static const Map<String, int> agePresets = {
    'Toddler (0-2)': 0,
    'Preschool (3-5)': 3,
    'Primary (6-12)': 6,
    'Teen (13-18)': 13,
  };
}
