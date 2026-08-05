import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/auth_repository.dart';

final authRepositoryProvider = Provider((ref) => AuthRepository());

final authControllerProvider = StateNotifierProvider<AuthController, AsyncValue<void>>((ref) {
  return AuthController(ref.watch(authRepositoryProvider));
});

class AuthController extends StateNotifier<AsyncValue<void>> {
  final AuthRepository _repository;

  AuthController(this._repository) : super(const AsyncData(null));

  Future<bool> login(String identifier, String password) async {
    state = const AsyncLoading();
    try {
      await _repository.login(identifier, password);
      state = const AsyncData(null);
      return true;
    } catch (e, st) {
      state = AsyncError(e.toString(), st);
      return false;
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AsyncData(null);
  }
}
