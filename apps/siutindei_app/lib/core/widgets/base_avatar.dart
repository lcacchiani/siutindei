import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/tokens/tokens.dart';
import 'token_aware_widget.dart';

/// Avatar sizes available.
enum AvatarSize { sm, md, lg }

/// Base avatar component that consumes avatar tokens.
class BaseAvatar extends TokenAwareWidget {
  const BaseAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.size = AvatarSize.md,
  });

  final String name;
  final String? imageUrl;
  final AvatarSize size;

  @override
  Widget buildWithTokens(
    BuildContext context,
    WidgetRef ref,
    ComponentTokens tokens,
  ) {
    final avatarTokens = tokens.avatar;

    final dimension = switch (size) {
      AvatarSize.sm => avatarTokens.sizeSm,
      AvatarSize.md => avatarTokens.sizeMd,
      AvatarSize.lg => avatarTokens.sizeLg,
    };

    return Container(
      width: dimension,
      height: dimension,
      decoration: BoxDecoration(
        color: avatarTokens.background,
        borderRadius: BorderRadius.circular(avatarTokens.borderRadius),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null
          ? Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _buildInitials(avatarTokens),
            )
          : _buildInitials(avatarTokens),
    );
  }

  Widget _buildInitials(AvatarTokens tokens) {
    final initials = name.isNotEmpty
        ? name
            .split(' ')
            .take(2)
            .map((e) => e.isNotEmpty ? e[0].toUpperCase() : '')
            .join()
        : '?';

    return Center(
      child: Text(
        initials,
        style: TextStyle(
          color: tokens.foreground,
          fontWeight: FontWeight.w600,
          fontSize: tokens.fontSize,
        ),
      ),
    );
  }
}
