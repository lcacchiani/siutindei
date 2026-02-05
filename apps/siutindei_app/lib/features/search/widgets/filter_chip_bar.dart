import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/constants.dart';
import '../../../config/tokens/tokens.dart';
import '../../../core/core.dart';

/// Horizontal scrolling filter chip bar using leaf tokens.
class FilterChipBar extends ConsumerWidget {
  const FilterChipBar({
    super.key,
    required this.children,
    this.padding,
  });

  final List<Widget> children;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final semantic = ref.watch(semanticTokensProvider);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding ?? EdgeInsets.symmetric(horizontal: semantic.spacing.md),
      child: Row(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) SizedBox(width: semantic.spacing.sm),
          ],
        ],
      ),
    );
  }
}

/// Filter chip that uses leaf tokens.
class TokenFilterChip extends ConsumerWidget {
  const TokenFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(componentTokensProvider).filterChip;

    return GestureDetector(
      onTap: () => onSelected(!selected),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: tokens.paddingHorizontal,
          vertical: tokens.paddingVertical,
        ),
        decoration: BoxDecoration(
          color: selected ? tokens.backgroundSelected : tokens.background,
          borderRadius: BorderRadius.circular(tokens.borderRadius),
          border: Border.all(
            color: selected ? tokens.borderSelected : tokens.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? tokens.textSelected : tokens.text,
            fontSize: tokens.fontSize,
            fontWeight: selected ? tokens.fontWeightSelected : tokens.fontWeight,
          ),
        ),
      ),
    );
  }
}

/// Dropdown filter chip that shows options in a bottom sheet.
class DropdownFilterChip extends ConsumerWidget {
  const DropdownFilterChip({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.displayNameBuilder,
  });

  final String label;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;
  final String Function(String)? displayNameBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(componentTokensProvider).filterChip;
    final hasValue = value != null;
    final displayValue = hasValue
        ? (displayNameBuilder?.call(value!) ?? value!)
        : label;

    return GestureDetector(
      onTap: () => _showOptions(context, ref),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: tokens.paddingHorizontal,
          vertical: tokens.paddingVertical,
        ),
        decoration: BoxDecoration(
          color: hasValue ? tokens.backgroundSelected : tokens.background,
          borderRadius: BorderRadius.circular(tokens.borderRadius),
          border: Border.all(
            color: hasValue ? tokens.borderSelected : tokens.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              displayValue,
              style: TextStyle(
                color: hasValue ? tokens.textSelected : tokens.text,
                fontSize: tokens.fontSize,
                fontWeight:
                    hasValue ? tokens.fontWeightSelected : tokens.fontWeight,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.arrow_drop_down,
              size: 18,
              color: hasValue ? tokens.textSelected : tokens.dropdownIcon,
            ),
          ],
        ),
      ),
    );
  }

  void _showOptions(BuildContext context, WidgetRef ref) {
    final semantic = ref.read(semanticTokensProvider);
    final bottomSheet = ref.read(componentTokensProvider).bottomSheet;

    showModalBottomSheet(
      context: context,
      backgroundColor: bottomSheet.background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(bottomSheet.borderRadius),
        ),
      ),
      builder: (context) => _DropdownOptionsSheet(
        title: label,
        options: options,
        selectedValue: value,
        onSelected: (selected) {
          Navigator.pop(context);
          onChanged(selected);
        },
        displayNameBuilder: displayNameBuilder,
        semantic: semantic,
      ),
    );
  }
}

class _DropdownOptionsSheet extends StatelessWidget {
  const _DropdownOptionsSheet({
    required this.title,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
    required this.semantic,
    this.displayNameBuilder,
  });

  final String title;
  final List<String> options;
  final String? selectedValue;
  final ValueChanged<String?> onSelected;
  final SemanticTokens semantic;
  final String Function(String)? displayNameBuilder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.all(semantic.spacing.md),
            child: Row(
              children: [
                Text(title, style: semantic.text.titleMedium),
                const Spacer(),
                if (selectedValue != null)
                  TextButton(
                    onPressed: () => onSelected(null),
                    child: const Text('Clear'),
                  ),
              ],
            ),
          ),
          Divider(height: 1, color: semantic.color.border),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: options.length,
              itemBuilder: (context, index) {
                final option = options[index];
                final isSelected = option == selectedValue;
                final displayName =
                    displayNameBuilder?.call(option) ?? option;
                return ListTile(
                  title: Text(displayName),
                  trailing: isSelected
                      ? Icon(Icons.check, color: semantic.color.primary)
                      : null,
                  onTap: () => onSelected(option),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Filter badge showing active filter count.
class FilterBadge extends ConsumerWidget {
  const FilterBadge({
    super.key,
    required this.count,
    required this.onTap,
  });

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = ref.watch(componentTokensProvider).filterChip;
    final hasFilters = count > 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: tokens.paddingHorizontal,
          vertical: tokens.paddingVertical,
        ),
        decoration: BoxDecoration(
          color: hasFilters ? tokens.backgroundSelected : tokens.background,
          borderRadius: BorderRadius.circular(tokens.borderRadius),
          border: Border.all(
            color: hasFilters ? tokens.borderSelected : tokens.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.tune,
              size: 18,
              color: hasFilters ? tokens.textSelected : tokens.text,
            ),
            const SizedBox(width: 4),
            Text(
              'Filters',
              style: TextStyle(
                color: hasFilters ? tokens.textSelected : tokens.text,
                fontSize: tokens.fontSize,
                fontWeight:
                    hasFilters ? tokens.fontWeightSelected : tokens.fontWeight,
              ),
            ),
            if (hasFilters) ...[
              const SizedBox(width: 6),
              CountBadge(count: count),
            ],
          ],
        ),
      ),
    );
  }
}
