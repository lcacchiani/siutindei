import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../viewmodels/auth_viewmodel.dart';
import '../widgets/app_text_field.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _codeStep = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authViewModelProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
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
            if (_codeStep) ...[
              AppTextField(
                label: 'Confirmation code',
                controller: _codeController,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              AppTextField(
                label: 'New password',
                controller: _newPasswordController,
                obscureText: true,
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
                  : () async {
                      final username = _emailController.text.trim();
                      if (_codeStep) {
                        await ref.read(authViewModelProvider.notifier).confirmPasswordReset(
                              username: username,
                              newPassword: _newPasswordController.text,
                              confirmationCode: _codeController.text.trim(),
                            );
                        if (mounted) {
                          Navigator.of(context).pop();
                        }
                      } else {
                        await ref
                            .read(authViewModelProvider.notifier)
                            .requestPasswordReset(username: username);
                        if (mounted) {
                          setState(() {
                            _codeStep = true;
                          });
                        }
                      }
                    },
              child: authState.isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(_codeStep ? 'Confirm' : 'Send code'),
            ),
          ],
        ),
      ),
    );
  }
}
