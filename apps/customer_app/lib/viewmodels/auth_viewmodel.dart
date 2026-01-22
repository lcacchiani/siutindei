import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/amplify_service.dart';
import '../services/auth_service.dart';

class AuthState {
  const AuthState({
    required this.isLoading,
    required this.isSignedIn,
    this.errorMessage,
  });

  final bool isLoading;
  final bool isSignedIn;
  final String? errorMessage;

  factory AuthState.initial() => const AuthState(isLoading: true, isSignedIn: false);

  AuthState copyWith({
    bool? isLoading,
    bool? isSignedIn,
    String? errorMessage,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isSignedIn: isSignedIn ?? this.isSignedIn,
      errorMessage: errorMessage,
    );
  }
}

class AuthViewModel extends StateNotifier<AuthState> {
  AuthViewModel(this._amplifyService, this._authService)
      : super(AuthState.initial()) {
    _initialize();
  }

  final AmplifyService _amplifyService;
  final AuthService _authService;

  Future<void> _initialize() async {
    try {
      await _amplifyService.configure();
      final signedIn = await _authService.isSignedIn();
      state = state.copyWith(isLoading: false, isSignedIn: signedIn);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> signIn({required String username, required String password}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _authService.signIn(username: username, password: password);
      state = state.copyWith(isLoading: false, isSignedIn: true);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> signOut() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _authService.signOut();
      state = state.copyWith(isLoading: false, isSignedIn: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }
}

final authViewModelProvider =
    StateNotifierProvider<AuthViewModel, AuthState>((ref) {
  final amplifyService = AmplifyService();
  final authService = AuthService();
  return AuthViewModel(amplifyService, authService);
});
