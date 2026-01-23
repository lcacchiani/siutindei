import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../viewmodels/auth_viewmodel.dart';
import '../widgets/app_text_field.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            AppTextField(
              label: 'Email',
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            if (!authState.needsConfirmation)
              AppTextField(
                label: 'Password',
                controller: _passwordController,
                obscureText: true,
              ),
            if (authState.needsConfirmation) ...[
              const SizedBox(height: 12),
              AppTextField(
                label: 'Confirmation code',
                controller: _codeController,
                keyboardType: TextInputType.number,
              ),
            ],
            const SizedBox(height: 12),
            if (authState.errorMessage != null)
              Text(
                authState.errorMessage!,
                style: const TextStyle(color: Colors.red),
              ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: authState.isLoading
                  ? null
                  : () {
                      final username = _emailController.text.trim();
                      if (authState.needsConfirmation) {
                        ref.read(authViewModelProvider.notifier).confirmSignUp(
                              username: authState.pendingUsername ?? username,
                              confirmationCode: _codeController.text.trim(),
                            );
                      } else {
                        ref.read(authViewModelProvider.notifier).signUp(
                              username: username,
                              password: _passwordController.text,
                            );
                      }
                    },
              child: authState.isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(authState.needsConfirmation ? 'Confirm' : 'Create account'),
            ),
            if (authState.needsConfirmation)
              TextButton(
                onPressed: authState.isLoading
                    ? null
                    : () {
                        final username = authState.pendingUsername ??
                            _emailController.text.trim();
                        ref
                            .read(authViewModelProvider.notifier)
                            .resendConfirmationCode(username: username);
                      },
                child: const Text('Resend code'),
              ),
            if (!authState.needsConfirmation)
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Back to sign in'),
              ),
          ],
        ),
      ),
    );
  }
}
