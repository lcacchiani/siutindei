import 'package:flutter/material.dart';

import '../../config/app_theme.dart';

/// A horizontally scrollable row of filter chips.
class FilterChipRow extends StatelessWidget {
  const FilterChipRow({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding,
      child: Row(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

/// A selectable filter chip with custom styling.
class AppFilterChip extends StatelessWidget {
  const AppFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.avatar,
    this.showCheckmark = false,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool> onSelected;
  final Widget? avatar;
  final bool showCheckmark;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: onSelected,
      avatar: avatar,
      showCheckmark: showCheckmark,
      selectedColor: AppTheme.primaryColor.withValues(alpha: 0.15),
      checkmarkColor: AppTheme.primaryColor,
      labelStyle: TextStyle(
        color: selected ? AppTheme.primaryColor : AppTheme.textSecondary,
        fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
      ),
      side: BorderSide(
        color: selected ? AppTheme.primaryColor : AppTheme.borderColor,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
    );
  }
}

/// A dropdown filter chip that shows a menu when tapped.
class DropdownFilterChip extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final hasValue = value != null;
    final displayValue = hasValue
        ? (displayNameBuilder?.call(value!) ?? value!)
        : label;

    return InkWell(
      onTap: () => _showMenu(context),
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: hasValue
              ? AppTheme.primaryColor.withValues(alpha: 0.15)
              : AppTheme.backgroundLight,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: hasValue ? AppTheme.primaryColor : AppTheme.borderColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              displayValue,
              style: TextStyle(
                color: hasValue ? AppTheme.primaryColor : AppTheme.textSecondary,
                fontWeight: hasValue ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.arrow_drop_down,
              size: 18,
              color: hasValue ? AppTheme.primaryColor : AppTheme.textSecondary,
            ),
          ],
        ),
      ),
    );
  }

  void _showMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => _DropdownOptionsSheet(
        title: label,
        options: options,
        selectedValue: value,
        onSelected: (selected) {
          Navigator.pop(context);
          onChanged(selected);
        },
        displayNameBuilder: displayNameBuilder,
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
    this.displayNameBuilder,
  });

  final String title;
  final List<String> options;
  final String? selectedValue;
  final ValueChanged<String?> onSelected;
  final String Function(String)? displayNameBuilder;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                if (selectedValue != null)
                  TextButton(
                    onPressed: () => onSelected(null),
                    child: const Text('Clear'),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
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
                      ? const Icon(Icons.check, color: AppTheme.primaryColor)
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

/// A chip that shows the active filter count with a badge.
class ActiveFiltersBadge extends StatelessWidget {
  const ActiveFiltersBadge({
    super.key,
    required this.count,
    required this.onTap,
  });

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: count > 0
              ? AppTheme.primaryColor.withValues(alpha: 0.15)
              : AppTheme.backgroundLight,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: count > 0 ? AppTheme.primaryColor : AppTheme.borderColor,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.tune,
              size: 18,
              color: count > 0 ? AppTheme.primaryColor : AppTheme.textSecondary,
            ),
            const SizedBox(width: 4),
            Text(
              'Filters',
              style: TextStyle(
                color:
                    count > 0 ? AppTheme.primaryColor : AppTheme.textSecondary,
                fontWeight: count > 0 ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
