import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/network/api_client.dart';

class AuthRepository {
  Future<Map<String, dynamic>> login(String identifier, String password) async {
    try {
      final isEmail = identifier.contains('@');
      final data = {
        if (isEmail) 'email': identifier else 'phone': identifier,
        'password': password,
      };

      final response = await apiClient.dio.post('/auth/client/login', data: data);
      
      final token = response.data['token'];
      if (token != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', token);
      }
      
      return response.data;
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to login. Please try again.';
    } catch (e) {
      throw 'An unexpected error occurred.';
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }
}
