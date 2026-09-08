import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Where the auth token lives.
///
/// It used to sit in SharedPreferences, which is plain unencrypted storage —
/// readable from a device backup, or by any process with filesystem access on a
/// rooted or jailbroken handset. A member's token grants their health profile,
/// diet chart, attendance and payment history, and it is valid for a week, so
/// one extracted token is a week of access.
///
/// This moves it to the platform keystore: Keychain on iOS, an
/// EncryptedSharedPreferences-backed store on Android.
///
/// Tokens written by an earlier build are migrated on first read and then
/// deleted, so upgrading users are not silently signed out.
class TokenStore {
  static const _key = 'auth_token';
  static const _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String?> read() async {
    final token = await _secure.read(key: _key);
    if (token != null) return token;

    // One-time migration from the old plaintext location.
    final prefs = await SharedPreferences.getInstance();
    final legacy = prefs.getString(_key);
    if (legacy != null) {
      await _secure.write(key: _key, value: legacy);
      await prefs.remove(_key);
      return legacy;
    }
    return null;
  }

  static Future<void> write(String token) => _secure.write(key: _key, value: token);

  static Future<void> clear() async {
    await _secure.delete(key: _key);
    // Clear the legacy copy too, in case migration never ran on this device.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
