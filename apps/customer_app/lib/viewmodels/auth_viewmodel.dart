import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/amplify_service.dart';
import '../services/auth_service.dart';

class AuthState {
  const AuthState({
    required this.isLoading,
    required this.isSignedIn,
    required this.needsConfirmation,
    this.pendingUsername,
    this.errorMessage,
  });

  final bool isLoading;
  final bool isSignedIn;
  final bool needsConfirmation;
  final String? pendingUsername;
  final String? errorMessage;

  factory AuthState.initial() => const AuthState(
        isLoading: true,
        isSignedIn: false,
        needsConfirmation: false,
      );

  AuthState copyWith({
    bool? isLoading,
    bool? isSignedIn,
    bool? needsConfirmation,
    String? pendingUsername,
    String? errorMessage,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isSignedIn: isSignedIn ?? this.isSignedIn,
      needsConfirmation: needsConfirmation ?? this.needsConfirmation,
      pendingUsername: pendingUsername ?? this.pendingUsername,
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
      state = state.copyWith(
        isLoading: false,
        isSignedIn: signedIn,
        needsConfirmation: false,
        pendingUsername: null,
      );
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
      state = state.copyWith(
        isLoading: false,
        isSignedIn: false,
        needsConfirmation: false,
        pendingUsername: null,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> signUp({required String username, required String password}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await _authService.signUp(username: username, password: password);
      final needsConfirm = result;
      state = state.copyWith(
        isLoading: false,
        needsConfirmation: needsConfirm,
        pendingUsername: needsConfirm ? username : null,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> confirmSignUp({
    required String username,
    required String confirmationCode,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _authService.confirmSignUp(
        username: username,
        confirmationCode: confirmationCode,
      );
      state = state.copyWith(
        isLoading: false,
        needsConfirmation: false,
        pendingUsername: null,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> resendConfirmationCode({required String username}) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _authService.resendSignUpCode(username: username);
      state = state.copyWith(isLoading: false);
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
