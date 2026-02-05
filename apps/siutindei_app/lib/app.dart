import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/theme/theme_provider.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'views/screens/home_screen.dart';

/// Main application widget.
///
/// Uses the theme system from [themeDataProvider] which allows easy theme
/// switching. To change the app's design:
///
/// 1. Create a new theme class extending [SiutindeiTheme]
/// 2. Update [themeProvider] in theme_provider.dart to return your theme
///
/// The current theme is the "Default" test design - a placeholder for
/// development. Replace it with your brand design when ready.
class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authViewModelProvider);
    // Use the theme from provider - change themeProvider to switch designs
    final themeData = ref.watch(themeDataProvider);

    return MaterialApp(
      title: 'Siu Tin Dei',
      theme: themeData,
      debugShowCheckedModeBanner: false,
      home: authState.isLoading
          ? const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            )
          : const HomeScreen(),
    );
  }
}
