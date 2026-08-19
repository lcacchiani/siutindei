import 'package:url_launcher/url_launcher.dart';

/// Opens [url] in the platform's external browser.
///
/// Returns false when the URL is invalid or cannot be launched.
Future<bool> openExternalUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) {
    return false;
  }
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}
