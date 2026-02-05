import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/app_theme.dart';
import 'viewmodels/auth_viewmodel.dart';
import 'views/screens/home_screen.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authViewModelProvider);

    return MaterialApp(
      title: 'Siu Tin Dei',
      theme: AppTheme.lightTheme,
      debugShowCheckedModeBanner: false,
      home: authState.isLoading
          ? const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            )
          : const HomeScreen(),
    );
  }
}
