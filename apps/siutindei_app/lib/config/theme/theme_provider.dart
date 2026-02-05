import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'default_theme.dart';
import 'siutindei_theme.dart';

/// Provider for the current app theme.
///
/// ## Usage
///
/// Access the theme in widgets:
/// ```dart
/// class MyWidget extends ConsumerWidget {
///   Widget build(BuildContext context, WidgetRef ref) {
///     final theme = ref.watch(themeProvider);
///     return Container(color: theme.primaryColor);
///   }
/// }
/// ```
///
/// ## Switching Themes
///
/// To use a different theme, modify this provider:
/// ```dart
/// final themeProvider = Provider<SiutindeiTheme>((ref) {
///   return MyBrandTheme(); // Your custom theme
/// });
/// ```
///
/// For dynamic theme switching, use StateNotifierProvider:
/// ```dart
/// final themeProvider = StateNotifierProvider<ThemeNotifier, SiutindeiTheme>(
///   (ref) => ThemeNotifier(),
/// );
/// ```
final themeProvider = Provider<SiutindeiTheme>((ref) {
  // ============================================================
  // CHANGE THIS LINE TO USE A DIFFERENT THEME
  // ============================================================
  return const DefaultTheme();
});

/// Provider for the Flutter ThemeData generated from the current theme.
///
/// Use this in MaterialApp:
/// ```dart
/// MaterialApp(
///   theme: ref.watch(themeDataProvider),
/// )
/// ```
final themeDataProvider = Provider<ThemeData>((ref) {
  final theme = ref.watch(themeProvider);
  // Set the global theme reference for extension access
  setCurrentTheme(theme);
  return theme.toThemeData();
});

/// Notifier for dynamic theme switching (optional).
///
/// Use this if you need runtime theme switching:
/// ```dart
/// // In provider definition
/// final dynamicThemeProvider = StateNotifierProvider<ThemeNotifier, SiutindeiTheme>(
///   (ref) => ThemeNotifier(),
/// );
///
/// // To switch theme
/// ref.read(dynamicThemeProvider.notifier).setTheme(MyNewTheme());
/// ```
class ThemeNotifier extends StateNotifier<SiutindeiTheme> {
  ThemeNotifier() : super(const DefaultTheme());

  /// Switch to a different theme.
  void setTheme(SiutindeiTheme theme) {
    state = theme;
    setCurrentTheme(theme);
  }

  /// Reset to default theme.
  void resetToDefault() {
    setTheme(const DefaultTheme());
  }
}

/// Extension for convenient theme access from WidgetRef.
extension ThemeRefExtension on WidgetRef {
  /// Get the current theme.
  ///
  /// Usage:
  /// ```dart
  /// final theme = ref.theme;
  /// ```
  SiutindeiTheme get theme => watch(themeProvider);
}

/// Mixin for StatelessWidget/StatefulWidget to access theme.
///
/// Usage:
/// ```dart
/// class MyWidget extends StatelessWidget with ThemeAccessMixin {
///   Widget build(BuildContext context) {
///     final theme = getTheme(context);
///     return Container(color: theme.primaryColor);
///   }
/// }
/// ```
mixin ThemeAccessMixin {
  /// Get theme from context (uses global theme).
  SiutindeiTheme getTheme(BuildContext context) {
    return context.siutindeiTheme;
  }
}
