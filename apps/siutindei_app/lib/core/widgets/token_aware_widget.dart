import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/tokens/tokens.dart';

/// Base class for widgets that consume design tokens.
///
/// Provides convenient access to the token system with a cleaner API.
///
/// ## Usage
///
/// ```dart
/// class MyButton extends TokenAwareWidget {
///   const MyButton({super.key, required this.label});
///   final String label;
///
///   @override
///   Widget buildWithTokens(BuildContext context, WidgetRef ref, ComponentTokens tokens) {
///     return Container(
///       color: tokens.button.primaryBackground,
///       padding: EdgeInsets.symmetric(
///         horizontal: tokens.button.paddingHorizontal,
///         vertical: tokens.button.paddingVertical,
///       ),
///       child: Text(label),
///     );
///   }
/// }
/// ```
abstract class TokenAwareWidget extends ConsumerWidget {
  const TokenAwareWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(componentTokensProvider);
    return buildWithTokens(context, ref, tokens);
  }

  /// Build the widget with access to component tokens.
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  );
}

/// Base class for stateful widgets that consume design tokens.
abstract class TokenAwareStatefulWidget extends ConsumerStatefulWidget {
  const TokenAwareStatefulWidget({super.key});
}

/// State mixin for easy token access in stateful widgets.
mixin TokenAwareStateMixin<T extends ConsumerStatefulWidget>
    on ConsumerState<T> {
  /// Get component (leaf) tokens.
  ComponentTokens get tokens => ref.watch(componentTokensProvider);

  /// Get all design tokens.
  DesignTokens get designTokens => ref.watch(designTokensProvider);

  /// Get semantic tokens.
  SemanticTokens get semanticTokens => ref.watch(semanticTokensProvider);
}

/// Extension providing shortcuts for token access.
extension TokenWidgetRefExtension on WidgetRef {
  /// Shortcut to component tokens.
  ComponentTokens get tokens => watch(componentTokensProvider);

  /// Shortcut to button tokens.
  ButtonTokens get buttonTokens => tokens.button;

  /// Shortcut to card tokens.
  CardTokens get cardTokens => tokens.card;

  /// Shortcut to input tokens.
  InputTokens get inputTokens => tokens.input;

  /// Shortcut to activity card tokens.
  ActivityCardTokens get activityCardTokens => tokens.activityCard;

  /// Shortcut to filter chip tokens.
  FilterChipTokens get filterChipTokens => tokens.filterChip;
}
