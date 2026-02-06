# Design Token System

The design token system provides a hierarchical, maintainable approach to styling that supports theming and design system integration.

## Overview

Design tokens are organized in three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Tokens                          │
│  (Leaf tokens: ActivityCard, Button, SearchBar, etc.)       │
├─────────────────────────────────────────────────────────────┤
│                    Semantic Tokens                           │
│  (Meaningful abstractions: primary, textPrimary, etc.)      │
├─────────────────────────────────────────────────────────────┤
│                    Primitive Tokens                          │
│  (Raw values: indigo500, space4, fontMedium, etc.)          │
└─────────────────────────────────────────────────────────────┘
```

## Location

```
lib/config/tokens/
├── tokens.dart              # Barrel file
├── primitive_tokens.dart    # Raw design values
├── semantic_tokens.dart     # Meaningful abstractions
├── component_tokens.dart    # Widget-specific tokens
├── token_registry.dart      # Aggregation and providers
└── README.md                # Token system overview
```

## Token Layers

### Primitive Tokens

Raw, foundational design values with no semantic meaning.

```dart
class PrimitiveColors {
  const PrimitiveColors({
    this.indigo50 = const Color(0xFFEEF2FF),
    this.indigo100 = const Color(0xFFE0E7FF),
    this.indigo500 = const Color(0xFF6366F1),
    this.indigo600 = const Color(0xFF4F46E5),
    this.indigo700 = const Color(0xFF4338CA),
    // ... more colors
  });

  final Color indigo50;
  final Color indigo100;
  final Color indigo500;
  final Color indigo600;
  final Color indigo700;
  // ...
}

class PrimitiveSpacing {
  const PrimitiveSpacing({
    this.space0 = 0.0,
    this.space1 = 4.0,
    this.space2 = 8.0,
    this.space3 = 12.0,
    this.space4 = 16.0,
    this.space5 = 20.0,
    this.space6 = 24.0,
    this.space8 = 32.0,
    // ...
  });

  final double space0;
  final double space1;
  final double space2;
  // ...
}
```

### Semantic Tokens

Meaningful abstractions that reference primitive tokens.

```dart
class SemanticColors {
  SemanticColors({
    PrimitiveColors primitives = const PrimitiveColors(),
  })  : primary = primitives.indigo500,
        primaryHover = primitives.indigo600,
        primaryPressed = primitives.indigo700,
        primaryMuted = primitives.indigo50,
        onPrimary = primitives.white,
        background = primitives.white,
        surface = primitives.white,
        surfaceMuted = primitives.gray50,
        textPrimary = primitives.gray900,
        textSecondary = primitives.gray600,
        textTertiary = primitives.gray400,
        border = primitives.gray200,
        error = primitives.red500,
        success = primitives.green500,
        warning = primitives.amber500;

  final Color primary;
  final Color primaryHover;
  final Color primaryPressed;
  final Color primaryMuted;
  final Color onPrimary;
  final Color background;
  final Color surface;
  final Color surfaceMuted;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color border;
  final Color error;
  final Color success;
  final Color warning;
}

class SemanticSpacing {
  SemanticSpacing({
    PrimitiveSpacing primitives = const PrimitiveSpacing(),
  })  : xs = primitives.space1,
        sm = primitives.space2,
        md = primitives.space4,
        lg = primitives.space6,
        xl = primitives.space8;

  final double xs;
  final double sm;
  final double md;
  final double lg;
  final double xl;
}
```

### Component Tokens

Widget-specific "leaf" tokens for fine-grained control.

```dart
class ActivityCardTokens {
  ActivityCardTokens({
    required SemanticColors colors,
    required SemanticSpacing spacing,
    required SemanticRadius radius,
    required SemanticText text,
  })  : background = colors.surface,
        border = colors.border,
        borderRadius = radius.md,
        padding = spacing.md,
        gap = spacing.sm,
        titleColor = colors.textPrimary,
        titleFontSize = text.titleMedium.fontSize ?? 16,
        titleFontWeight = FontWeight.w600,
        organizationColor = colors.primary,
        organizationFontSize = 13,
        locationColor = colors.textSecondary,
        locationFontSize = 12,
        locationIconColor = colors.textTertiary,
        ageBackground = colors.primaryMuted,
        ageForeground = colors.primary,
        ageFontSize = 12,
        scheduleColor = colors.textSecondary,
        scheduleFontSize = 13,
        scheduleIconColor = colors.textTertiary;

  final Color background;
  final Color border;
  final double borderRadius;
  final double padding;
  final double gap;
  final Color titleColor;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color organizationColor;
  final double organizationFontSize;
  final Color locationColor;
  final double locationFontSize;
  final Color locationIconColor;
  final Color ageBackground;
  final Color ageForeground;
  final double ageFontSize;
  final Color scheduleColor;
  final double scheduleFontSize;
  final Color scheduleIconColor;
}
```

## Token Registry

Aggregates all token layers and provides Riverpod access.

```dart
class DesignTokens {
  DesignTokens({
    PrimitiveColors? primitiveColors,
    PrimitiveSpacing? primitiveSpacing,
    PrimitiveRadius? primitiveRadius,
    PrimitiveTypography? primitiveTypography,
  }) {
    final colors = primitiveColors ?? const PrimitiveColors();
    final spacing = primitiveSpacing ?? const PrimitiveSpacing();
    final radius = primitiveRadius ?? const PrimitiveRadius();
    final typography = primitiveTypography ?? const PrimitiveTypography();

    // Build semantic layer
    semantic = SemanticTokens(
      color: SemanticColors(primitives: colors),
      spacing: SemanticSpacing(primitives: spacing),
      radius: SemanticRadius(primitives: radius),
      text: SemanticText(primitives: typography),
      shadow: SemanticShadow(),
    );

    // Build component layer
    component = ComponentTokens(
      activityCard: ActivityCardTokens(
        colors: semantic.color,
        spacing: semantic.spacing,
        radius: semantic.radius,
        text: semantic.text,
      ),
      // ... more components
    );
  }

  late final SemanticTokens semantic;
  late final ComponentTokens component;
}
```

## Riverpod Providers

```dart
/// The main design tokens provider.
final designTokensProvider = Provider<DesignTokens>((ref) {
  return DesignTokens();
});

/// Semantic tokens provider.
final semanticTokensProvider = Provider<SemanticTokens>((ref) {
  return ref.watch(designTokensProvider).semantic;
});

/// Component tokens provider.
final componentTokensProvider = Provider<ComponentTokens>((ref) {
  return ref.watch(designTokensProvider).component;
});

/// ThemeData built from tokens.
final tokenThemeDataProvider = Provider<ThemeData>((ref) {
  final tokens = ref.watch(semanticTokensProvider);
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.light(
      primary: tokens.color.primary,
      onPrimary: tokens.color.onPrimary,
      surface: tokens.color.surface,
      error: tokens.color.error,
    ),
    // ... more theme configuration
  );
});
```

## Using Tokens in Widgets

### Basic Usage

```dart
class MyWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = ref.watch(semanticTokensProvider).color;
    final spacing = ref.watch(semanticTokensProvider).spacing;

    return Container(
      padding: EdgeInsets.all(spacing.md),
      color: colors.surface,
      child: Text(
        'Hello',
        style: TextStyle(color: colors.textPrimary),
      ),
    );
  }
}
```

### With Component Tokens

```dart
class ActivityCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(componentTokensProvider).activityCard;

    return Container(
      padding: EdgeInsets.all(tokens.padding),
      decoration: BoxDecoration(
        color: tokens.background,
        borderRadius: BorderRadius.circular(tokens.borderRadius),
        border: Border.all(color: tokens.border),
      ),
      child: Text(
        title,
        style: TextStyle(
          color: tokens.titleColor,
          fontSize: tokens.titleFontSize,
          fontWeight: tokens.titleFontWeight,
        ),
      ),
    );
  }
}
```

### Optimized Usage

Use `select` for granular rebuilds:

```dart
// Only rebuilds when spacing changes
final spacing = ref.watch(
  semanticTokensProvider.select((s) => s.spacing),
);

// Only rebuilds when activityCard tokens change
final tokens = ref.watch(
  componentTokensProvider.select((t) => t.activityCard),
);
```

## Available Component Tokens

| Component | Token Class | Purpose |
|-----------|-------------|---------|
| Activity Card | `ActivityCardTokens` | Activity search result cards |
| Button | `ButtonTokens` | Primary/secondary buttons |
| Input | `InputTokens` | Text fields and inputs |
| Filter Chip | `FilterChipTokens` | Filter chips and tags |
| Price Tag | `PriceTagTokens` | Price display badges |
| Search Bar | `SearchBarTokens` | Search input styling |
| Card | `CardTokens` | Generic card containers |
| Avatar | `AvatarTokens` | User/org avatars |
| Badge | `BadgeTokens` | Status/info badges |
| Bottom Sheet | `BottomSheetTokens` | Modal bottom sheets |
| Chip | `ChipTokens` | Generic chips |

## Customization

### Overriding Tokens

Create custom token instances:

```dart
final customTokensProvider = Provider<DesignTokens>((ref) {
  return DesignTokens(
    primitiveColors: PrimitiveColors(
      indigo500: Color(0xFF0066CC), // Custom primary
    ),
  );
});
```

### Theme Switching

```dart
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.light);

final designTokensProvider = Provider<DesignTokens>((ref) {
  final mode = ref.watch(themeModeProvider);
  return mode == ThemeMode.dark
      ? DesignTokens(primitiveColors: darkColors)
      : DesignTokens();
});
```

## JSON Token Ingestion

Tokens can be loaded from JSON for design tool integration:

```dart
class TokenLoader {
  static Future<DesignTokens> loadFromJson(String jsonString) async {
    final json = jsonDecode(jsonString) as Map<String, dynamic>;

    return DesignTokens(
      primitiveColors: PrimitiveColors.fromJson(json['colors']),
      primitiveSpacing: PrimitiveSpacing.fromJson(json['spacing']),
      primitiveRadius: PrimitiveRadius.fromJson(json['radius']),
      primitiveTypography: PrimitiveTypography.fromJson(json['typography']),
    );
  }
}
```

See [JSON Token Ingestion](json-tokens.md) for details.

## Best Practices

1. **Use semantic tokens in most cases** - They provide meaningful names
2. **Use component tokens for specific widgets** - Fine-grained control
3. **Use `select` for performance** - Minimize rebuilds
4. **Don't hardcode colors/spacing** - Always use tokens
5. **Create component tokens for new widgets** - Maintain consistency

## Related

- [JSON Token Ingestion](json-tokens.md) - Loading tokens from JSON
- [Theme Customization](customization.md) - Customizing the theme
- [Base Widgets](../core/widgets.md) - Token-aware base components
