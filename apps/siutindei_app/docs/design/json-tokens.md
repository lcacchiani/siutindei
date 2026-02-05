# JSON Token Ingestion

The token system supports loading design tokens from JSON, enabling integration with design tools like Figma, Style Dictionary, or custom design systems.

## Overview

JSON token ingestion allows:
- Loading tokens from external JSON files
- Dynamic theme switching
- Design tool integration
- Runtime theme customization

## JSON Format

### Primitive Tokens

```json
{
  "colors": {
    "indigo50": "#EEF2FF",
    "indigo100": "#E0E7FF",
    "indigo500": "#6366F1",
    "indigo600": "#4F46E5",
    "indigo700": "#4338CA",
    "gray50": "#F9FAFB",
    "gray100": "#F3F4F6",
    "gray200": "#E5E7EB",
    "gray600": "#4B5563",
    "gray900": "#111827",
    "white": "#FFFFFF",
    "red500": "#EF4444",
    "green500": "#22C55E",
    "amber500": "#F59E0B"
  },
  "spacing": {
    "space0": 0,
    "space1": 4,
    "space2": 8,
    "space3": 12,
    "space4": 16,
    "space5": 20,
    "space6": 24,
    "space8": 32
  },
  "radius": {
    "none": 0,
    "sm": 4,
    "md": 8,
    "lg": 12,
    "xl": 16,
    "full": 9999
  },
  "typography": {
    "fontFamily": "Inter",
    "fontSizeXs": 12,
    "fontSizeSm": 14,
    "fontSizeMd": 16,
    "fontSizeLg": 18,
    "fontSizeXl": 20,
    "fontSize2xl": 24,
    "fontSize3xl": 30,
    "fontWeightNormal": 400,
    "fontWeightMedium": 500,
    "fontWeightSemibold": 600,
    "fontWeightBold": 700
  }
}
```

## Token Loader

The `TokenLoader` class handles JSON parsing:

```dart
class TokenLoader {
  /// Loads design tokens from a JSON string.
  static DesignTokens fromJson(String jsonString) {
    final json = jsonDecode(jsonString) as Map<String, dynamic>;
    return fromMap(json);
  }

  /// Loads design tokens from a Map.
  static DesignTokens fromMap(Map<String, dynamic> json) {
    return DesignTokens(
      primitiveColors: json['colors'] != null
          ? PrimitiveColors.fromJson(json['colors'] as Map<String, dynamic>)
          : null,
      primitiveSpacing: json['spacing'] != null
          ? PrimitiveSpacing.fromJson(json['spacing'] as Map<String, dynamic>)
          : null,
      primitiveRadius: json['radius'] != null
          ? PrimitiveRadius.fromJson(json['radius'] as Map<String, dynamic>)
          : null,
      primitiveTypography: json['typography'] != null
          ? PrimitiveTypography.fromJson(
              json['typography'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Loads design tokens from an asset file.
  static Future<DesignTokens> fromAsset(String assetPath) async {
    final jsonString = await rootBundle.loadString(assetPath);
    return fromJson(jsonString);
  }

  /// Loads design tokens from a network URL.
  static Future<DesignTokens> fromUrl(String url) async {
    final response = await http.get(Uri.parse(url));
    if (response.statusCode == 200) {
      return fromJson(response.body);
    }
    throw Exception('Failed to load tokens from $url');
  }
}
```

## Primitive Token Factories

Each primitive token class has a `fromJson` factory:

```dart
class PrimitiveColors {
  // ... fields ...

  factory PrimitiveColors.fromJson(Map<String, dynamic> json) {
    Color? parseColor(String? hex) {
      if (hex == null) return null;
      final cleanHex = hex.replaceFirst('#', '');
      return Color(int.parse('FF$cleanHex', radix: 16));
    }

    return PrimitiveColors(
      indigo50: parseColor(json['indigo50']) ?? const Color(0xFFEEF2FF),
      indigo100: parseColor(json['indigo100']) ?? const Color(0xFFE0E7FF),
      indigo500: parseColor(json['indigo500']) ?? const Color(0xFF6366F1),
      // ... more fields with defaults
    );
  }
}

class PrimitiveSpacing {
  // ... fields ...

  factory PrimitiveSpacing.fromJson(Map<String, dynamic> json) {
    return PrimitiveSpacing(
      space0: (json['space0'] as num?)?.toDouble() ?? 0.0,
      space1: (json['space1'] as num?)?.toDouble() ?? 4.0,
      space2: (json['space2'] as num?)?.toDouble() ?? 8.0,
      // ... more fields with defaults
    );
  }
}
```

## Usage Examples

### Loading from Asset

```dart
// assets/tokens/brand-tokens.json
final loadedTokensProvider = FutureProvider<DesignTokens>((ref) async {
  return TokenLoader.fromAsset('assets/tokens/brand-tokens.json');
});

// In widget
class MyApp extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokensAsync = ref.watch(loadedTokensProvider);

    return tokensAsync.when(
      data: (tokens) => ProviderScope(
        overrides: [
          designTokensProvider.overrideWithValue(tokens),
        ],
        child: MaterialApp(...),
      ),
      loading: () => MaterialApp(home: LoadingScreen()),
      error: (e, _) => MaterialApp(home: ErrorScreen(error: e)),
    );
  }
}
```

### Loading from Network

```dart
final remoteTokensProvider = FutureProvider<DesignTokens>((ref) async {
  return TokenLoader.fromUrl('https://api.example.com/design-tokens');
});
```

### Switching Themes

```dart
final selectedThemeProvider = StateProvider<String>((ref) => 'default');

final dynamicTokensProvider = FutureProvider<DesignTokens>((ref) async {
  final themeName = ref.watch(selectedThemeProvider);
  return TokenLoader.fromAsset('assets/tokens/$themeName.json');
});

// UI to switch themes
DropdownButton<String>(
  value: ref.watch(selectedThemeProvider),
  items: ['default', 'dark', 'brand-a', 'brand-b']
      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
      .toList(),
  onChanged: (theme) {
    ref.read(selectedThemeProvider.notifier).state = theme!;
  },
)
```

## Figma Integration

### Exporting from Figma

1. Use the **Design Tokens** plugin in Figma
2. Export tokens in JSON format
3. Transform to match expected structure

### Style Dictionary Integration

If using [Style Dictionary](https://amzn.github.io/style-dictionary/):

```json
// style-dictionary/tokens.json
{
  "color": {
    "primary": {
      "50": { "value": "#EEF2FF" },
      "500": { "value": "#6366F1" }
    }
  }
}
```

Transform for this system:

```dart
static DesignTokens fromStyleDictionary(Map<String, dynamic> sd) {
  final colors = sd['color'] as Map<String, dynamic>;
  return DesignTokens(
    primitiveColors: PrimitiveColors(
      indigo50: _parseColor(colors['primary']['50']['value']),
      indigo500: _parseColor(colors['primary']['500']['value']),
    ),
  );
}
```

## Build-Time vs Runtime Loading

### Build-Time (Recommended for Production)

```dart
// Generated from CI/build process
class GeneratedTokens {
  static const tokens = DesignTokens(
    primitiveColors: PrimitiveColors(
      indigo500: Color(0xFF6366F1),
      // ... generated values
    ),
  );
}
```

### Runtime (Development/Preview)

```dart
// Load dynamically for design preview
final previewTokensProvider = FutureProvider<DesignTokens>((ref) async {
  return TokenLoader.fromUrl('${devServer}/preview-tokens');
});
```

## Validation

Validate loaded tokens:

```dart
class TokenValidator {
  static List<String> validate(DesignTokens tokens) {
    final errors = <String>[];

    // Check required colors exist
    if (tokens.semantic.color.primary == Colors.transparent) {
      errors.add('Primary color is not set');
    }

    // Check spacing values are positive
    if (tokens.semantic.spacing.md <= 0) {
      errors.add('Medium spacing must be positive');
    }

    // Check contrast ratios
    final contrast = _calculateContrast(
      tokens.semantic.color.primary,
      tokens.semantic.color.onPrimary,
    );
    if (contrast < 4.5) {
      errors.add('Primary/onPrimary contrast ratio is below 4.5:1');
    }

    return errors;
  }
}
```

## Best Practices

1. **Use defaults** - Always provide fallback values in factories
2. **Validate on load** - Check token values are valid
3. **Cache loaded tokens** - Avoid repeated network/file reads
4. **Version tokens** - Include version in JSON for cache invalidation
5. **Build-time for production** - Generate Dart code from JSON in CI

## Related

- [Design Tokens](tokens.md) - Token system overview
- [Theme Customization](customization.md) - Runtime customization
