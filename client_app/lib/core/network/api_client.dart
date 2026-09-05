import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'token_store.dart';

/// Raised when the session is no longer valid.
///
/// The interceptor used to pass every error straight through, so an expired
/// token — inevitable, since they last seven days — surfaced as whatever error
/// state the calling screen happened to render rather than sending the member
/// back to sign in. The web admin has always handled this; the app never did.
class SessionExpiredException implements Exception {
  const SessionExpiredException();
  @override
  String toString() => 'Your session has expired. Please sign in again.';
}

/// Raised when the facility's plan does not include the feature.
///
/// The API answers 402 with `code: MODULE_NOT_ENABLED` for a module the
/// facility has not bought. That is not an error the member caused and not
/// something a retry fixes — screens should hide the feature rather than show a
/// failure.
class FeatureUnavailableException implements Exception {
  const FeatureUnavailableException(this.module);
  final String? module;
  @override
  String toString() => 'This feature is not part of your gym\'s plan.';
}

class ApiClient {
  // The Android emulator reaches the host machine at 10.0.2.2, not localhost
  // (localhost on Android points at the emulator itself). iOS Simulator, web
  // and desktop all reach the host via localhost. For a physical device, set
  // this to the host's LAN IP instead.
  static String get baseUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }

  /// Set by the app shell so an expired session can route back to sign-in.
  static void Function()? onSessionExpired;

  final Dio dio;

  ApiClient() : dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await TokenStore.read();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        if (kDebugMode) {
          print('API Error ${e.response?.statusCode}: ${e.response?.data}');
        }

        final status = e.response?.statusCode;
        final path = e.requestOptions.path;

        // 401 on anything other than the login call itself means the token is
        // gone or expired: drop it and let the shell send them to sign in.
        if (status == 401 && !path.contains('/auth/')) {
          await TokenStore.clear();
          onSessionExpired?.call();
          return handler.reject(DioException(
            requestOptions: e.requestOptions,
            response: e.response,
            error: const SessionExpiredException(),
          ));
        }

        if (status == 402) {
          final data = e.response?.data;
          final module = data is Map ? data['module'] as String? : null;
          return handler.reject(DioException(
            requestOptions: e.requestOptions,
            response: e.response,
            error: FeatureUnavailableException(module),
          ));
        }

        return handler.next(e);
      },
    ));
  }
}

final apiClient = ApiClient();
