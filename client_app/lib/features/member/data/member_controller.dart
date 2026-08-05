import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import 'member_model.dart';

/// Shared across all member screens. Kept alive (not autoDispose) so switching
/// tabs doesn't refetch. Call `ref.invalidate(meProvider)` to refresh.
final meProvider = FutureProvider<MemberMe>((ref) async {
  final response = await apiClient.dio.get('/client/me');
  return MemberMe.fromJson(Map<String, dynamic>.from(response.data));
});

/// Full attendance history + summary (streak). Backed by GET /client/attendance.
final attendanceProvider = FutureProvider<AttendanceData>((ref) async {
  final response = await apiClient.dio.get('/client/attendance');
  return AttendanceData.fromJson(Map<String, dynamic>.from(response.data));
});
