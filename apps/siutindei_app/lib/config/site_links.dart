/// Links to the public Siu Tin Dei website.
///
/// The website is the canonical host for legal documents so that the
/// app, admin console, and store listings always reference one source.
class SiteLinks {
  SiteLinks._();

  /// Base URL of the public website, overridable per environment via
  /// `--dart-define=PUBLIC_WWW_BASE_URL=...`.
  static const publicWwwBaseUrl = String.fromEnvironment(
    'PUBLIC_WWW_BASE_URL',
    defaultValue: 'https://siutindei.com',
  );

  /// Privacy Policy page on the public website.
  static const privacyPolicyUrl = '$publicWwwBaseUrl/privacy';

  /// Terms of Use page on the public website.
  static const termsOfUseUrl = '$publicWwwBaseUrl/terms';
}
