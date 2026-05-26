class AppAmplifyConfig {
  static const apiName = String.fromEnvironment(
    'AMPLIFY_API_NAME',
    defaultValue: 'activitiesApi',
  );

  static const json = String.fromEnvironment('AMPLIFY_CONFIG');

  static const apiKey = String.fromEnvironment('AMPLIFY_API_KEY');

  static const stagingSearchDataEnabled = bool.fromEnvironment(
    'STAGING_SEARCH_DATA_ENABLED',
  );

  /// HTTPS URL of the staging search JSON (e.g. staging www
  /// `/fixtures/activity_search_staging.json`). Required when
  /// [stagingSearchDataEnabled] is true.
  static const stagingSearchFixtureUrl = String.fromEnvironment(
    'STAGING_SEARCH_FIXTURE_URL',
  );

  static String requireJson() {
    if (json.isEmpty) {
      throw StateError('AMPLIFY_CONFIG is not set');
    }
    return json;
  }
}
