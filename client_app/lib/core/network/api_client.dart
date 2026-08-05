import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

  final Dio dio;

  ApiClient() : dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('auth_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) {
        if (kDebugMode) {
          print('API Error: ${e.response?.data}');
        }
        return handler.next(e);
      },
    ));
  }
}

final apiClient = ApiClient();
