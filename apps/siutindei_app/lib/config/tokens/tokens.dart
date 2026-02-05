/// Design Tokens - Complete token system for the app.
///
/// This module provides a hierarchical token system:
///
/// ```
/// Primitive → Semantic → Component (Leaf)
/// ```
///
/// ## Quick Start
///
/// ```dart
/// import 'package:siutindei_app/config/tokens/tokens.dart';
///
/// class MyWidget extends ConsumerWidget {
///   Widget build(context, ref) {
///     // Access leaf tokens directly
///     final tokens = ref.tokens;
///
///     return Container(
///       color: tokens.activityCard.background,
///       padding: EdgeInsets.all(tokens.activityCard.padding),
///     );
///   }
/// }
/// ```
///
/// ## Ingesting Custom Tokens
///
/// ```dart
/// // From JSON file
/// final tokens = await TokenLoader.fromAsset('assets/tokens/brand.json');
///
/// // Or dynamically
/// ref.read(designTokensNotifierProvider.notifier).loadFromJson(brandJson);
/// ```
///
/// See [token_registry.dart] for detailed documentation.
library;

export 'component_tokens.dart';
export 'primitive_tokens.dart';
export 'semantic_tokens.dart';
export 'token_registry.dart';
