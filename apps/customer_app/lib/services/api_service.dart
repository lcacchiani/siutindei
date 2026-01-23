import 'dart:convert';

import 'package:amplify_api/amplify_api.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

import '../config/amplify_config.dart';
import '../models/activity_models.dart';
import 'auth_service.dart';

class ApiService {
  ApiService(this._authService);

  final AuthService _authService;

  Future<ActivitySearchResponse> searchActivities(ActivitySearchFilters filters) async {
    final tokens = await _authService.tryGetTokens();
    final headers = <String, String>{};
    if (tokens != null) {
      headers['Authorization'] = tokens.idToken;
    }
    if (AmplifyConfig.apiKey.isNotEmpty) {
      headers['x-api-key'] = AmplifyConfig.apiKey;
    }
    final options = RestOptions(
      apiName: AmplifyConfig.apiName,
      path: '/activities/search',
      queryParameters: filters.toQueryParameters(),
      headers: headers,
    );
    final response = await Amplify.API.get(options).response;
    final decoded = jsonDecode(response.decodeBody()) as Map<String, dynamic>;
    return ActivitySearchResponse.fromJson(decoded);
  }
}
