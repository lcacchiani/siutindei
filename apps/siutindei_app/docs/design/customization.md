# Theme Customization

This guide covers how to customize the app's appearance using the design token system.

## Overview

Customization options:
- Override primitive tokens for brand colors
- Create custom semantic mappings
- Add new component tokens
- Support multiple themes (light/dark)
- Runtime theme switching

## Quick Customization

### Changing Primary Color

Override primitive colors to change the brand color:

```dart
final customTokensProvider = Provider<DesignTokens>((ref) {
  return DesignTokens(
    primitiveColors: PrimitiveColors(
      // Your brand colors
      indigo50: Color(0xFFE3F2FD),  // Light blue
      indigo100: Color(0xFFBBDEFB),
      indigo500: Color(0xFF2196F3), // Blue primary
      indigo600: Color(0xFF1E88E5),
      indigo700: Color(0xFF1976D2),
    ),
  );
});
```

### Changing Spacing Scale

```dart
final customTokensProvider = Provider<DesignTokens>((ref) {
  return DesignTokens(
    primitiveSpacing: PrimitiveSpacing(
      space1: 2.0,   // Tighter spacing
      space2: 4.0,
      space3: 8.0,
      space4: 12.0,
      space5: 16.0,
      space6: 20.0,
      space8: 28.0,
    ),
  );
});
```

### Changing Border Radius

```dart
final customTokensProvider = Provider<DesignTokens>((ref) {
  return DesignTokens(
    primitiveRadius: PrimitiveRadius(
      sm: 2.0,   // Sharper corners
      md: 4.0,
      lg: 6.0,
      xl: 8.0,
      full: 9999.0,
    ),
  );
});
```

## Dark Theme

### Creating Dark Primitives

```dart
const darkPrimitiveColors = PrimitiveColors(
  // Dark theme specific colors
  white: Color(0xFF121212),        // Dark background
  gray50: Color(0xFF1E1E1E),
  gray100: Color(0xFF2C2C2C),
  gray200: Color(0xFF3D3D3D),
  gray600: Color(0xFFB0B0B0),
  gray900: Color(0xFFF5F5F5),      // Light text
  
  // Keep brand colors
  indigo500: Color(0xFF818CF8),    // Lighter for dark bg
  indigo600: Color(0xFF6366F1),
);
```

### Theme Mode Provider

```dart
enum AppThemeMode { light, dark, system }

final themeModeProvider = StateProvider<AppThemeMode>((ref) {
  return AppThemeMode.system;
});

final designTokensProvider = Provider<DesignTokens>((ref) {
  final mode = ref.watch(themeModeProvider);
  
  switch (mode) {
    case AppThemeMode.light:
      return DesignTokens();
    case AppThemeMode.dark:
      return DesignTokens(primitiveColors: darkPrimitiveColors);
    case AppThemeMode.system:
      // Detect system preference
      final brightness = WidgetsBinding.instance.window.platformBrightness;
      return brightness == Brightness.dark
          ? DesignTokens(primitiveColors: darkPrimitiveColors)
          : DesignTokens();
  }
});
```

### Theme Switcher Widget

```dart
class ThemeSwitcher extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentMode = ref.watch(themeModeProvider);

    return SegmentedButton<AppThemeMode>(
      segments: [
        ButtonSegment(value: AppThemeMode.light, icon: Icon(Icons.light_mode)),
        ButtonSegment(value: AppThemeMode.system, icon: Icon(Icons.auto_mode)),
        ButtonSegment(value: AppThemeMode.dark, icon: Icon(Icons.dark_mode)),
      ],
      selected: {currentMode},
      onSelectionChanged: (selection) {
        ref.read(themeModeProvider.notifier).state = selection.first;
      },
    );
  }
}
```

## Brand Themes

### Multiple Brand Support

```dart
enum BrandTheme { default_, brandA, brandB }

final brandThemeProvider = StateProvider<BrandTheme>((ref) {
  return BrandTheme.default_;
});

final designTokensProvider = Provider<DesignTokens>((ref) {
  final brand = ref.watch(brandThemeProvider);
  
  return switch (brand) {
    BrandTheme.default_ => DesignTokens(),
    BrandTheme.brandA => DesignTokens(
        primitiveColors: brandAColors,
        primitiveTypography: brandATypography,
      ),
    BrandTheme.brandB => DesignTokens(
        primitiveColors: brandBColors,
        primitiveSpacing: brandBSpacing,
      ),
  };
});
```

### Brand A Colors

```dart
const brandAColors = PrimitiveColors(
  indigo50: Color(0xFFFFF3E0),
  indigo100: Color(0xFFFFE0B2),
  indigo500: Color(0xFFFF9800),  // Orange primary
  indigo600: Color(0xFFF57C00),
  indigo700: Color(0xFFEF6C00),
);
```

## Adding Custom Component Tokens

### 1. Define Token Class

```dart
class MyCustomWidgetTokens {
  MyCustomWidgetTokens({
    required SemanticColors colors,
    required SemanticSpacing spacing,
    required SemanticRadius radius,
  })  : background = colors.surface,
        accentColor = colors.primary,
        padding = spacing.md,
        borderRadius = radius.lg,
        elevation = 4.0;

  final Color background;
  final Color accentColor;
  final double padding;
  final double borderRadius;
  final double elevation;
}
```

### 2. Add to ComponentTokens

```dart
class ComponentTokens {
  ComponentTokens({
    required SemanticTokens semantic,
  })  : activityCard = ActivityCardTokens(...),
        // ... existing tokens
        myCustomWidget = MyCustomWidgetTokens(
          colors: semantic.color,
          spacing: semantic.spacing,
          radius: semantic.radius,
        );

  // ... existing fields
  final MyCustomWidgetTokens myCustomWidget;
}
```

### 3. Use in Widget

```dart
class MyCustomWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(
      componentTokensProvider.select((t) => t.myCustomWidget),
    );

    return Material(
      elevation: tokens.elevation,
      borderRadius: BorderRadius.circular(tokens.borderRadius),
      color: tokens.background,
      child: Padding(
        padding: EdgeInsets.all(tokens.padding),
        child: // ...
      ),
    );
  }
}
```

## Semantic Token Customization

### Custom Semantic Mapping

```dart
class CustomSemanticColors extends SemanticColors {
  CustomSemanticColors({
    required PrimitiveColors primitives,
  }) : super(primitives: primitives) {
    // Override specific mappings
    // Can't directly override final fields, so use different approach
  }
}

// Better approach - factory method
SemanticColors createCustomSemantics(PrimitiveColors primitives) {
  return SemanticColors(primitives: primitives);
  // Or create a new class with custom logic
}
```

## Runtime Customization

### User Preferences

```dart
class ThemePreferences {
  final Color? primaryColor;
  final double? borderRadius;
  final bool useLargeText;
}

final themePreferencesProvider = StateProvider<ThemePreferences>((ref) {
  return ThemePreferences(useLargeText: false);
});

final designTokensProvider = Provider<DesignTokens>((ref) {
  final prefs = ref.watch(themePreferencesProvider);
  
  return DesignTokens(
    primitiveColors: prefs.primaryColor != null
        ? PrimitiveColors(indigo500: prefs.primaryColor!)
        : null,
    primitiveRadius: prefs.borderRadius != null
        ? PrimitiveRadius(md: prefs.borderRadius!)
        : null,
    primitiveTypography: prefs.useLargeText
        ? PrimitiveTypography(fontSizeMd: 18)
        : null,
  );
});
```

### Settings Screen

```dart
class ThemeSettingsScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(themePreferencesProvider);

    return ListView(
      children: [
        SwitchListTile(
          title: Text('Large Text'),
          value: prefs.useLargeText,
          onChanged: (value) {
            ref.read(themePreferencesProvider.notifier).state =
                ThemePreferences(useLargeText: value);
          },
        ),
        // Color picker for primary color
        // Slider for border radius
      ],
    );
  }
}
```

## Accessibility Considerations

### High Contrast Mode

```dart
final highContrastProvider = StateProvider<bool>((ref) => false);

final designTokensProvider = Provider<DesignTokens>((ref) {
  final highContrast = ref.watch(highContrastProvider);
  
  if (highContrast) {
    return DesignTokens(
      primitiveColors: PrimitiveColors(
        gray600: Color(0xFF000000),  // Pure black text
        white: Color(0xFFFFFFFF),    // Pure white background
      ),
    );
  }
  
  return DesignTokens();
});
```

### Reduced Motion

```dart
final reducedMotionProvider = StateProvider<bool>((ref) {
  return MediaQuery.of(context).disableAnimations;
});

// Use in animations
final duration = ref.watch(reducedMotionProvider)
    ? Duration.zero
    : Duration(milliseconds: 300);
```

## Testing Custom Themes

```dart
testWidgets('renders correctly with custom theme', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        designTokensProvider.overrideWithValue(
          DesignTokens(
            primitiveColors: PrimitiveColors(
              indigo500: Colors.red,
            ),
          ),
        ),
      ],
      child: MaterialApp(home: MyWidget()),
    ),
  );

  // Verify red color is applied
  final container = tester.widget<Container>(find.byType(Container));
  expect((container.decoration as BoxDecoration).color, equals(Colors.red));
});
```

## Related

- [Design Tokens](tokens.md) - Token system overview
- [JSON Token Ingestion](json-tokens.md) - Loading tokens from JSON
