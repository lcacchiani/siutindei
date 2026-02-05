import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/tokens/tokens.dart';
import 'token_aware_widget.dart';

/// Base card component that consumes card tokens.
///
/// All card-like components should extend or compose this widget
/// to ensure consistent styling from the token system.
class BaseCard extends TokenAwareWidget {
  const BaseCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets? padding;

  @override
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  ) {
    final cardTokens = tokens.card;

    return Container(
      decoration: BoxDecoration(
        color: cardTokens.background,
        borderRadius: BorderRadius.circular(cardTokens.borderRadius),
        border: Border.all(color: cardTokens.border),
        boxShadow: cardTokens.shadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(cardTokens.borderRadius),
          child: Padding(
            padding: padding ?? EdgeInsets.all(cardTokens.padding),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Section card with title header.
class SectionCard extends TokenAwareWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.action,
  });

  final String title;
  final Widget child;
  final IconData? icon;
  final Widget? action;

  @override
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  ) {
    final cardTokens = tokens.card;
    final semantic = ref.watch(semanticTokensProvider);

    return Container(
      decoration: BoxDecoration(
        color: cardTokens.background,
        borderRadius: BorderRadius.circular(cardTokens.borderRadius),
        border: Border.all(color: cardTokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.all(cardTokens.padding),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    size: 20,
                    color: semantic.color.textSecondary,
                  ),
                  SizedBox(width: cardTokens.gap),
                ],
                Text(
                  title,
                  style: semantic.text.labelLarge,
                ),
                if (action != null) ...[
                  const Spacer(),
                  action!,
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              cardTokens.padding,
              0,
              cardTokens.padding,
              cardTokens.padding,
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}
