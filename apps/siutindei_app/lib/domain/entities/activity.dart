/// Domain entity representing an activity.
///
/// This is a pure business object without any framework dependencies.
/// It represents the core concept of an activity in the domain.
class ActivityEntity {
  const ActivityEntity({
    required this.id,
    required this.name,
    this.description,
    this.ageMin,
    this.ageMax,
  });

  final String id;
  final String name;
  final String? description;
  final int? ageMin;
  final int? ageMax;

  /// Returns a display string for the age range.
  String? get ageRangeDisplay {
    if (ageMin == null && ageMax == null) return null;
    if (ageMin != null && ageMax != null) return '$ageMin-$ageMax years';
    if (ageMin != null) return '$ageMin+ years';
    return 'Up to $ageMax years';
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ActivityEntity &&
          other.id == id &&
          other.name == name &&
          other.description == description &&
          other.ageMin == ageMin &&
          other.ageMax == ageMax);

  @override
  int get hashCode => Object.hash(id, name, description, ageMin, ageMax);

  @override
  String toString() => 'ActivityEntity(id: $id, name: $name)';
}

/// Domain entity representing an organization.
class OrganizationEntity {
  const OrganizationEntity({
    required this.id,
    required this.name,
    this.description,
    this.pictureUrls = const [],
  });

  final String id;
  final String name;
  final String? description;
  final List<String> pictureUrls;

  /// Returns the primary picture URL, if available.
  String? get primaryPictureUrl =>
      pictureUrls.isNotEmpty ? pictureUrls.first : null;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OrganizationEntity &&
          other.id == id &&
          other.name == name &&
          other.description == description);

  @override
  int get hashCode => Object.hash(id, name, description);

  @override
  String toString() => 'OrganizationEntity(id: $id, name: $name)';
}

/// Domain entity representing a location.
class LocationEntity {
  const LocationEntity({
    required this.id,
    required this.district,
    this.address,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String district;
  final String? address;
  final double? latitude;
  final double? longitude;

  /// Returns true if this location has coordinates.
  bool get hasCoordinates => latitude != null && longitude != null;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocationEntity &&
          other.id == id &&
          other.district == district &&
          other.address == address);

  @override
  int get hashCode => Object.hash(id, district, address);

  @override
  String toString() => 'LocationEntity(id: $id, district: $district)';
}

/// Domain entity representing pricing information.
class PricingEntity {
  const PricingEntity({
    required this.type,
    required this.amount,
    required this.currency,
    this.sessionsCount,
  });

  final PricingType type;
  final double amount;
  final String currency;
  final int? sessionsCount;

  /// Returns true if this is free.
  bool get isFree => type == PricingType.free || amount == 0;

  /// Returns a formatted price string.
  String get formattedPrice {
    if (isFree) return 'Free';
    final priceStr = '${amount.toStringAsFixed(0)} $currency';
    return switch (type) {
      PricingType.perSession => '$priceStr/session',
      PricingType.perMonth => '$priceStr/month',
      PricingType.perYear => '$priceStr/year',
      PricingType.oneTime => priceStr,
      PricingType.free => 'Free',
    };
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PricingEntity &&
          other.type == type &&
          other.amount == amount &&
          other.currency == currency);

  @override
  int get hashCode => Object.hash(type, amount, currency);
}

/// Pricing type enumeration.
enum PricingType {
  perSession,
  perMonth,
  perYear,
  oneTime,
  free;

  /// Creates from API string value.
  static PricingType fromString(String value) => switch (value) {
        'per_session' => PricingType.perSession,
        'per_month' => PricingType.perMonth,
        'per_year' => PricingType.perYear,
        'one_time' => PricingType.oneTime,
        'free' => PricingType.free,
        _ => PricingType.oneTime,
      };

  /// Returns the API string value.
  String toApiString() => switch (this) {
        PricingType.perSession => 'per_session',
        PricingType.perMonth => 'per_month',
        PricingType.perYear => 'per_year',
        PricingType.oneTime => 'one_time',
        PricingType.free => 'free',
      };
}

/// Domain entity representing a schedule.
class ScheduleEntity {
  const ScheduleEntity({
    required this.type,
    this.dayOfWeekUtc,
    this.dayOfMonth,
    this.startMinutesUtc,
    this.endMinutesUtc,
    this.startAtUtc,
    this.endAtUtc,
    this.languages = const [],
  });

  final ScheduleType type;
  final int? dayOfWeekUtc;
  final int? dayOfMonth;
  final int? startMinutesUtc;
  final int? endMinutesUtc;
  final DateTime? startAtUtc;
  final DateTime? endAtUtc;
  final List<String> languages;

  /// Returns a formatted time string.
  String? get formattedTime {
    if (startMinutesUtc == null) return null;
    final startHour = startMinutesUtc! ~/ 60;
    final startMin = startMinutesUtc! % 60;
    final startStr =
        '${startHour.toString().padLeft(2, '0')}:${startMin.toString().padLeft(2, '0')}';

    if (endMinutesUtc == null) return startStr;
    final endHour = endMinutesUtc! ~/ 60;
    final endMin = endMinutesUtc! % 60;
    final endStr =
        '${endHour.toString().padLeft(2, '0')}:${endMin.toString().padLeft(2, '0')}';
    return '$startStr - $endStr';
  }

  /// Returns the day of week as a string.
  String? get dayOfWeekName {
    if (dayOfWeekUtc == null) return null;
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
    if (dayOfWeekUtc! >= 0 && dayOfWeekUtc! < 7) {
      return days[dayOfWeekUtc!];
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ScheduleEntity &&
          other.type == type &&
          other.dayOfWeekUtc == dayOfWeekUtc &&
          other.startMinutesUtc == startMinutesUtc);

  @override
  int get hashCode => Object.hash(type, dayOfWeekUtc, startMinutesUtc);
}

/// Schedule type enumeration.
enum ScheduleType {
  weekly,
  monthly,
  oneTime,
  flexible;

  /// Creates from API string value.
  static ScheduleType fromString(String value) => switch (value) {
        'weekly' => ScheduleType.weekly,
        'monthly' => ScheduleType.monthly,
        'one_time' => ScheduleType.oneTime,
        'flexible' => ScheduleType.flexible,
        _ => ScheduleType.flexible,
      };

  /// Returns the API string value.
  String toApiString() => switch (this) {
        ScheduleType.weekly => 'weekly',
        ScheduleType.monthly => 'monthly',
        ScheduleType.oneTime => 'one_time',
        ScheduleType.flexible => 'flexible',
      };
}
