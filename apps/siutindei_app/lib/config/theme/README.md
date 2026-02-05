# Theme System Documentation

This document explains the architecture separating **design** from **functionality** in the siutindei_app.

## Overview

The app uses a clear separation between:

| Aspect | Location | Purpose |
|--------|----------|---------|
| **Design** | `lib/config/theme/` | Colors, typography, spacing, component styles |
| **Functionality** | `lib/config/constants.dart` | Languages, districts, business logic constants |

This separation allows you to completely redesign the app's appearance by swapping the theme without touching any business logic or data constants.

## Directory Structure

```
lib/config/
├── theme/
│   ├── siutindei_theme.dart    # Abstract theme interface
│   ├── default_theme.dart      # Default/test design (PLACEHOLDER)
│   ├── theme_provider.dart     # Riverpod provider for theme access
│   ├── theme.dart              # Barrel file for exports
│   └── README.md               # This file
├── constants.dart              # Functional/business constants
├── app_theme.dart              # Legacy compatibility layer
├── amplify_config.dart         # AWS Amplify configuration
└── firebase_config.dart        # Firebase configuration
```

## Current Design Status

The **DefaultTheme** (`default_theme.dart`) is a **placeholder/test design** intended for development. It provides:

- Clean, functional UI for testing features
- Complete implementation of all theme tokens
- Reference for creating custom themes

**This is NOT the final brand design.** Replace it with your own theme when ready.

## How to Create a Custom Theme

### Step 1: Create Your Theme Class

Create a new file, e.g., `lib/config/theme/my_brand_theme.dart`:

```dart
import 'package:flutter/material.dart';
import 'siutindei_theme.dart';

class MyBrandTheme extends SiutindeiTheme {
  const MyBrandTheme();

  @override
  String get themeId => 'my_brand';

  @override
  String get themeName => 'My Brand Design';

  // Override all color tokens
  @override
  Color get primaryColor => const Color(0xFF...); // Your brand color

  @override
  Color get primaryLight => const Color(0xFF...);

  // ... override all other tokens from SiutindeiTheme
}
```

### Step 2: Register Your Theme

Update `theme_provider.dart`:

```dart
import 'my_brand_theme.dart';

final themeProvider = Provider<SiutindeiTheme>((ref) {
  return const MyBrandTheme(); // Use your theme instead of DefaultTheme
});
```

### Step 3: That's It!

The entire app will use your new design. No other code changes needed.

## Theme Tokens Reference

The `SiutindeiTheme` abstract class defines these categories:

### Colors
| Token | Purpose |
|-------|---------|
| `primaryColor` | Main brand color for actions |
| `primaryLight` | Lighter variant for hover/pressed |
| `primaryDark` | Darker variant for emphasis |
| `secondaryColor` | Accent color |
| `backgroundColor` | Scaffold background |
| `surfaceColor` | Card/dialog backgrounds |
| `textPrimary` | Headings, important text |
| `textSecondary` | Body text |
| `textTertiary` | Hints, placeholders |
| `errorColor` | Validation errors |
| `successColor` | Success states |
| `warningColor` | Warnings |
| `borderColor` | Dividers, outlines |

### Spacing (based on 4px grid)
| Token | Default | Purpose |
|-------|---------|---------|
| `spacingXs` | 4 | Tiny gaps |
| `spacingSm` | 8 | Small gaps |
| `spacingMd` | 16 | Default padding |
| `spacingLg` | 24 | Section spacing |
| `spacingXl` | 32 | Large spacing |

### Border Radius
| Token | Default | Purpose |
|-------|---------|---------|
| `radiusSm` | 8 | Chips, tags |
| `radiusMd` | 12 | Cards, inputs |
| `radiusLg` | 16 | Modals |
| `radiusXl` | 24 | Bottom sheets |

### Typography
| Token | Purpose |
|-------|---------|
| `headlineStyle` | Screen titles |
| `titleStyle` | Section headers |
| `bodyStyle` | Main content |
| `captionStyle` | Small labels |
| `labelStyle` | Form labels |

### Component Styles
| Token | Purpose |
|-------|---------|
| `elevatedButtonStyle` | Primary buttons |
| `outlinedButtonStyle` | Secondary buttons |
| `textButtonStyle` | Text-only buttons |
| `inputDecorationTheme` | Text fields |
| `cardTheme` | Cards |
| `chipTheme` | Filter chips |
| `appBarTheme` | App bars |
| `bottomSheetTheme` | Bottom sheets |

## Using the Theme in Widgets

### Method 1: Via Riverpod (Recommended)

```dart
class MyWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(themeProvider);
    
    return Container(
      color: theme.primaryColor,
      padding: EdgeInsets.all(theme.spacingMd),
      child: Text('Hello', style: theme.bodyStyle),
    );
  }
}
```

### Method 2: Via BuildContext Extension

```dart
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = context.siutindeiTheme;
    
    return Container(color: theme.primaryColor);
  }
}
```

### Method 3: Legacy AppTheme (Backward Compatible)

```dart
// This still works but is deprecated
Container(color: AppTheme.primaryColor)
```

## Functional Constants (Non-Design)

Constants that define app behavior live in `constants.dart`:

```dart
import 'package:siutindei_app/config/constants.dart';

// Language options (for API filters)
AppConstants.languageOptions  // {'en': 'English', 'zh': '中文', ...}

// District names (geographic data)
AppConstants.districts  // ['Central', 'Wan Chai', ...]

// Pricing types (business logic)
AppConstants.pricingTypes  // {'per_class': 'Per Class', ...}

// Time utilities (data formatting)
AppConstants.minutesToTimeString(600)  // "10:00 AM"
```

These constants should NOT be in theme files because:
- They define **what** the app does, not **how** it looks
- Changing districts shouldn't require a design review
- API parameters shouldn't change based on visual design

## Migration Guide

If you have existing code using the old `AppTheme`:

```dart
// Old (still works via compatibility layer)
import 'package:siutindei_app/config/app_theme.dart';
Container(color: AppTheme.primaryColor)

// New (recommended)
import 'package:siutindei_app/config/theme/theme.dart';
// In ConsumerWidget:
final theme = ref.watch(themeProvider);
Container(color: theme.primaryColor)
```

## FAQ

**Q: Why separate design from functionality?**
A: So designers can change the entire look of the app without affecting business logic, and developers can add features without accidentally breaking the design system.

**Q: Can I have multiple themes?**
A: Yes! Create multiple theme classes and switch between them using `ThemeNotifier`.

**Q: What about dark mode?**
A: Create a `DarkTheme extends SiutindeiTheme` with dark colors and switch themes at runtime.

**Q: The current design looks basic. Is that intentional?**
A: Yes! `DefaultTheme` is a placeholder for testing. Replace it with your brand design.
