import 'package:flutter/material.dart';

import '../../config/app_theme.dart';
import '../../models/activity_models.dart';

/// A bottom sheet for selecting advanced search filters.
class SearchFiltersSheet extends StatefulWidget {
  const SearchFiltersSheet({
    super.key,
    required this.initialFilters,
    required this.onApply,
  });

  final ActivitySearchFilters initialFilters;
  final ValueChanged<ActivitySearchFilters> onApply;

  /// Shows the search filters bottom sheet.
  static Future<void> show({
    required BuildContext context,
    required ActivitySearchFilters initialFilters,
    required ValueChanged<ActivitySearchFilters> onApply,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => SearchFiltersSheet(
        initialFilters: initialFilters,
        onApply: onApply,
      ),
    );
  }

  @override
  State<SearchFiltersSheet> createState() => _SearchFiltersSheetState();
}

class _SearchFiltersSheetState extends State<SearchFiltersSheet> {
  late ActivitySearchFilters _filters;

  final _ageController = TextEditingController();
  final _priceMinController = TextEditingController();
  final _priceMaxController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filters = widget.initialFilters;
    _ageController.text = _filters.age?.toString() ?? '';
    _priceMinController.text = _filters.priceMin?.toString() ?? '';
    _priceMaxController.text = _filters.priceMax?.toString() ?? '';
  }

  @override
  void dispose() {
    _ageController.dispose();
    _priceMinController.dispose();
    _priceMaxController.dispose();
    super.dispose();
  }

  void _updateFilters(ActivitySearchFilters Function(ActivitySearchFilters) updater) {
    setState(() {
      _filters = updater(_filters);
    });
  }

  void _clearAll() {
    setState(() {
      _filters = ActivitySearchFilters();
      _ageController.clear();
      _priceMinController.clear();
      _priceMaxController.clear();
    });
  }

  void _applyFilters() {
    // Update filters from text controllers
    final age = int.tryParse(_ageController.text);
    final priceMin = double.tryParse(_priceMinController.text);
    final priceMax = double.tryParse(_priceMaxController.text);

    final updatedFilters = _filters.copyWith(
      age: age,
      priceMin: priceMin,
      priceMax: priceMax,
      clearAge: age == null,
      clearPriceMin: priceMin == null,
      clearPriceMax: priceMax == null,
    );

    widget.onApply(updatedFilters);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          _buildHeader(),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              children: [
                _buildAgeSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildDistrictSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildPriceSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildPricingTypeSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildScheduleTypeSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildDayOfWeekSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildTimeRangeSection(),
                const SizedBox(height: AppTheme.spacingLg),
                _buildLanguagesSection(),
                const SizedBox(height: AppTheme.spacingXl),
              ],
            ),
          ),
          _buildApplyButton(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: AppTheme.borderColor),
        ),
      ),
      child: Row(
        children: [
          const Text(
            'Filters',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: _clearAll,
            child: const Text('Clear all'),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }

  Widget _buildAgeSection() {
    return _FilterSection(
      title: 'Child Age',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _ageController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              hintText: 'Enter age',
              prefixIcon: Icon(Icons.child_care),
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Wrap(
            spacing: 8,
            children: AppConstants.agePresets.entries.map((entry) {
              return ActionChip(
                label: Text(entry.key),
                onPressed: () {
                  _ageController.text = entry.value.toString();
                },
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildDistrictSection() {
    return _FilterSection(
      title: 'District',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: AppConstants.districts.map((district) {
          final isSelected = _filters.district == district;
          return FilterChip(
            label: Text(district),
            selected: isSelected,
            onSelected: (selected) {
              _updateFilters((f) => f.copyWith(
                    district: selected ? district : null,
                    clearDistrict: !selected,
                  ));
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPriceSection() {
    return _FilterSection(
      title: 'Price Range',
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _priceMinController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                hintText: 'Min',
                prefixText: '\$ ',
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('—'),
          ),
          Expanded(
            child: TextField(
              controller: _priceMaxController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                hintText: 'Max',
                prefixText: '\$ ',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPricingTypeSection() {
    return _FilterSection(
      title: 'Pricing Type',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: AppConstants.pricingTypes.entries.map((entry) {
          final isSelected = _filters.pricingType == entry.key;
          return FilterChip(
            label: Text(entry.value),
            selected: isSelected,
            onSelected: (selected) {
              _updateFilters((f) => f.copyWith(
                    pricingType: selected ? entry.key : null,
                    clearPricingType: !selected,
                  ));
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _buildScheduleTypeSection() {
    return _FilterSection(
      title: 'Schedule Type',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: AppConstants.scheduleTypes.entries.map((entry) {
          final isSelected = _filters.scheduleType == entry.key;
          return FilterChip(
            label: Text(entry.value),
            selected: isSelected,
            onSelected: (selected) {
              _updateFilters((f) => f.copyWith(
                    scheduleType: selected ? entry.key : null,
                    clearScheduleType: !selected,
                  ));
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDayOfWeekSection() {
    return _FilterSection(
      title: 'Day of Week',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: List.generate(7, (index) {
          final isSelected = _filters.dayOfWeekUtc == index;
          return FilterChip(
            label: Text(AppConstants.daysOfWeekShort[index]),
            selected: isSelected,
            onSelected: (selected) {
              _updateFilters((f) => f.copyWith(
                    dayOfWeekUtc: selected ? index : null,
                    clearDayOfWeekUtc: !selected,
                  ));
            },
          );
        }),
      ),
    );
  }

  Widget _buildTimeRangeSection() {
    return _FilterSection(
      title: 'Time Range',
      child: Row(
        children: [
          Expanded(
            child: _TimeSelector(
              label: 'Start time',
              minutes: _filters.startMinutesUtc,
              onChanged: (minutes) {
                _updateFilters((f) => f.copyWith(
                      startMinutesUtc: minutes,
                      clearStartMinutesUtc: minutes == null,
                    ));
              },
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text('—'),
          ),
          Expanded(
            child: _TimeSelector(
              label: 'End time',
              minutes: _filters.endMinutesUtc,
              onChanged: (minutes) {
                _updateFilters((f) => f.copyWith(
                      endMinutesUtc: minutes,
                      clearEndMinutesUtc: minutes == null,
                    ));
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLanguagesSection() {
    return _FilterSection(
      title: 'Languages',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: AppConstants.languageOptions.entries.map((entry) {
          final isSelected = _filters.languages.contains(entry.key);
          return FilterChip(
            label: Text(entry.value),
            selected: isSelected,
            onSelected: (selected) {
              final newLanguages = List<String>.from(_filters.languages);
              if (selected) {
                newLanguages.add(entry.key);
              } else {
                newLanguages.remove(entry.key);
              }
              _updateFilters((f) => f.copyWith(languages: newLanguages));
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _buildApplyButton() {
    final filterCount = _filters.activeFilterCount;
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: const BoxDecoration(
        color: AppTheme.surfaceColor,
        border: Border(
          top: BorderSide(color: AppTheme.borderColor),
        ),
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _applyFilters,
            child: Text(
              filterCount > 0
                  ? 'Apply $filterCount filter${filterCount > 1 ? 's' : ''}'
                  : 'Apply filters',
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterSection extends StatelessWidget {
  const _FilterSection({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: AppTheme.spacingSm),
        child,
      ],
    );
  }
}

class _TimeSelector extends StatelessWidget {
  const _TimeSelector({
    required this.label,
    required this.minutes,
    required this.onChanged,
  });

  final String label;
  final int? minutes;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _selectTime(context),
      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingMd,
        ),
        decoration: BoxDecoration(
          color: AppTheme.backgroundLight,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                minutes != null
                    ? AppConstants.minutesToTimeString(minutes!)
                    : label,
                style: TextStyle(
                  color: minutes != null
                      ? AppTheme.textPrimary
                      : AppTheme.textTertiary,
                ),
              ),
            ),
            if (minutes != null)
              GestureDetector(
                onTap: () => onChanged(null),
                child: const Icon(
                  Icons.clear,
                  size: 18,
                  color: AppTheme.textTertiary,
                ),
              )
            else
              const Icon(
                Icons.access_time,
                size: 18,
                color: AppTheme.textTertiary,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectTime(BuildContext context) async {
    final initialTime = minutes != null
        ? TimeOfDay(hour: minutes! ~/ 60, minute: minutes! % 60)
        : const TimeOfDay(hour: 9, minute: 0);

    final selected = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );

    if (selected != null) {
      onChanged(AppConstants.timeOfDayToMinutes(selected.hour, selected.minute));
    }
  }
}
