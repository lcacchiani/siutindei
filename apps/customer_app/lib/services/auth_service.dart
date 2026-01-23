import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

class AuthTokens {
  AuthTokens({required this.idToken, required this.accessToken});

  final String idToken;
  final String accessToken;
}

class AuthService {
  Future<bool> isSignedIn() async {
    final session = await Amplify.Auth.fetchAuthSession();
    return session.isSignedIn;
  }

  Future<AuthTokens> getTokens() async {
    final session = await Amplify.Auth.fetchAuthSession();
    if (session is CognitoAuthSession) {
      final tokensResult = session.userPoolTokensResult;
      if (tokensResult.isFailure) {
        throw tokensResult.error;
      }
      final tokens = tokensResult.value;
      return AuthTokens(
        idToken: tokens.idToken.raw,
        accessToken: tokens.accessToken.raw,
      );
    }
    throw const AuthException('Auth session is not Cognito.');
  }

  Future<void> signIn({required String username, required String password}) async {
    final result = await Amplify.Auth.signIn(
      username: username,
      password: password,
    );
    if (!result.isSignedIn) {
      throw const AuthException('Sign-in did not complete.');
    }
  }

  Future<bool> signUp({required String username, required String password}) async {
    final result = await Amplify.Auth.signUp(
      username: username,
      password: password,
    );
    return result.nextStep.signUpStep == AuthSignUpStep.confirmSignUp;
  }

  Future<void> confirmSignUp({
    required String username,
    required String confirmationCode,
  }) async {
    final result = await Amplify.Auth.confirmSignUp(
      username: username,
      confirmationCode: confirmationCode,
    );
    if (!result.isSignUpComplete) {
      throw const AuthException('Confirmation did not complete.');
    }
  }

  Future<void> resendSignUpCode({required String username}) async {
    await Amplify.Auth.resendSignUpCode(username: username);
  }

  Future<void> resetPassword({required String username}) async {
    final result = await Amplify.Auth.resetPassword(username: username);
    if (result.nextStep.resetPasswordStep !=
        AuthResetPasswordStep.confirmResetPasswordWithCode) {
      throw const AuthException('Password reset did not start.');
    }
  }

  Future<void> confirmResetPassword({
    required String username,
    required String newPassword,
    required String confirmationCode,
  }) async {
    await Amplify.Auth.confirmResetPassword(
      username: username,
      newPassword: newPassword,
      confirmationCode: confirmationCode,
    );
  }

  Future<void> signOut() async {
    await Amplify.Auth.signOut();
  }
}
