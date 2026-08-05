// Typed model for GET /api/client/me
import '../../../core/util/derive.dart';

num? _num(dynamic v) => v == null ? null : (v is num ? v : num.tryParse(v.toString()));

List<Map<String, dynamic>> _listOfMaps(dynamic v) {
  if (v is List) {
    return v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
  return const [];
}

class MemberMe {
  final Client client;
  final List<AttendanceEntry> recentAttendance;
  final List<PaymentEntry> recentPayments;

  MemberMe({
    required this.client,
    required this.recentAttendance,
    required this.recentPayments,
  });

  factory MemberMe.fromJson(Map<String, dynamic> j) {
    return MemberMe(
      client: Client.fromJson(Map<String, dynamic>.from(j['client'] ?? {})),
      recentAttendance: (j['recentAttendance'] as List? ?? [])
          .map((e) => AttendanceEntry.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      recentPayments: (j['recentPayments'] as List? ?? [])
          .map((e) => PaymentEntry.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class Client {
  final int id;
  final String name;
  final String? email;
  final String? phone;
  final String? gender;
  final num? height;
  final num? weight;
  final DateTime? joiningDate;
  final DateTime? billingRenewalDate;
  final DateTime? planExpiresAt;
  final String status; // active | inactive | payment_due
  final String? address;
  final Map<String, dynamic> customFields;
  final HealthProfile health;
  final List<dynamic> workoutPlans;
  final PlanInfo? plan;
  final FacilityInfo? facility;

  Client({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.gender,
    this.height,
    this.weight,
    this.joiningDate,
    this.billingRenewalDate,
    this.planExpiresAt,
    required this.status,
    this.address,
    required this.customFields,
    required this.health,
    required this.workoutPlans,
    this.plan,
    this.facility,
  });

  factory Client.fromJson(Map<String, dynamic> j) {
    return Client(
      id: (j['id'] ?? 0) as int,
      name: (j['name'] ?? '') as String,
      email: j['email'] as String?,
      phone: j['phone'] as String?,
      gender: j['gender'] as String?,
      height: _num(j['height']),
      weight: _num(j['weight']),
      joiningDate: Derive.parseDate(j['joiningDate']),
      billingRenewalDate: Derive.parseDate(j['billingRenewalDate']),
      planExpiresAt: Derive.parseDate(j['planExpiresAt']),
      status: (j['status'] ?? 'inactive') as String,
      address: j['address'] as String?,
      customFields: j['customFields'] is Map
          ? Map<String, dynamic>.from(j['customFields'])
          : {},
      health: HealthProfile.fromJson(
          j['healthProfile'] is Map ? Map<String, dynamic>.from(j['healthProfile']) : {}),
      workoutPlans: (j['workoutPlans'] is List) ? List.from(j['workoutPlans']) : const [],
      plan: j['Plan'] is Map ? PlanInfo.fromJson(Map<String, dynamic>.from(j['Plan'])) : null,
      facility:
          j['Facility'] is Map ? FacilityInfo.fromJson(Map<String, dynamic>.from(j['Facility'])) : null,
    );
  }

  bool get isActive => status == 'active';
  bool get hasDue => status == 'payment_due';
  String get memberId => 'GM-${id.toString().padLeft(6, '0')}';
}

class HealthProfile {
  final String? goalType;
  final num? currentWeight;
  final num? targetWeight;
  final num? height;
  final num? bodyFatPercentage;
  final String? notes;
  final List<Map<String, dynamic>> weeklyWeights;
  final List<Map<String, dynamic>> bodyCompositionHistory;
  final List<Map<String, dynamic>> measurementLogs;
  final List<Map<String, dynamic>> personalRecords;
  final List<Map<String, dynamic>> fitnessTests;
  final List<Map<String, dynamic>> mobilityScreenings;
  final List<Map<String, dynamic>> goalReviews;
  final Map<String, dynamic>? currentSchedule;
  final List<Map<String, dynamic>> workoutCalendar;

  HealthProfile({
    this.goalType,
    this.currentWeight,
    this.targetWeight,
    this.height,
    this.bodyFatPercentage,
    this.notes,
    required this.weeklyWeights,
    required this.bodyCompositionHistory,
    required this.measurementLogs,
    required this.personalRecords,
    required this.fitnessTests,
    required this.mobilityScreenings,
    required this.goalReviews,
    this.currentSchedule,
    required this.workoutCalendar,
  });

  factory HealthProfile.fromJson(Map<String, dynamic> j) {
    return HealthProfile(
      goalType: j['goalType'] as String?,
      currentWeight: _num(j['currentWeight']),
      targetWeight: _num(j['targetWeight']),
      height: _num(j['height']),
      bodyFatPercentage: _num(j['bodyFatPercentage']),
      notes: j['notes'] as String?,
      weeklyWeights: _listOfMaps(j['weeklyWeights']),
      bodyCompositionHistory: _listOfMaps(j['bodyCompositionHistory']),
      measurementLogs: _listOfMaps(j['measurementLogs']),
      personalRecords: _listOfMaps(j['personalRecords']),
      fitnessTests: _listOfMaps(j['fitnessTests']),
      mobilityScreenings: _listOfMaps(j['mobilityScreenings']),
      goalReviews: _listOfMaps(j['goalReviews']),
      currentSchedule:
          j['currentSchedule'] is Map ? Map<String, dynamic>.from(j['currentSchedule']) : null,
      workoutCalendar: _listOfMaps(j['workoutCalendar']),
    );
  }

  /// True when the admin has never captured any health data for this member.
  bool get isEmpty =>
      goalType == null &&
      currentWeight == null &&
      targetWeight == null &&
      bodyFatPercentage == null &&
      weeklyWeights.isEmpty &&
      bodyCompositionHistory.isEmpty &&
      measurementLogs.isEmpty;

  Map<String, dynamic>? get latestComposition =>
      bodyCompositionHistory.isNotEmpty ? bodyCompositionHistory.first : null;
  Map<String, dynamic>? get latestMeasurement =>
      measurementLogs.isNotEmpty ? measurementLogs.first : null;
}

class PlanInfo {
  final String name;
  final num price;
  final int duration; // months
  PlanInfo({required this.name, required this.price, required this.duration});
  factory PlanInfo.fromJson(Map<String, dynamic> j) => PlanInfo(
        name: (j['name'] ?? '') as String,
        price: _num(j['price']) ?? 0,
        duration: (j['duration'] ?? 0) as int,
      );
}

class FacilityInfo {
  final String name;
  FacilityInfo({required this.name});
  factory FacilityInfo.fromJson(Map<String, dynamic> j) =>
      FacilityInfo(name: (j['name'] ?? '') as String);
}

class AttendanceEntry {
  final DateTime? date;
  final String status; // present | absent | excused
  final String? checkInTime;
  AttendanceEntry({this.date, required this.status, this.checkInTime});
  factory AttendanceEntry.fromJson(Map<String, dynamic> j) => AttendanceEntry(
        date: Derive.parseDate(j['date']),
        status: (j['status'] ?? 'present') as String,
        checkInTime: j['checkInTime'] as String?,
      );
}

class AttendanceData {
  final List<AttendanceEntry> list;
  final int total;
  final int present;
  final int absent;
  final int excused;
  final int streak;

  AttendanceData({
    required this.list,
    required this.total,
    required this.present,
    required this.absent,
    required this.excused,
    required this.streak,
  });

  factory AttendanceData.fromJson(Map<String, dynamic> j) {
    final s = j['summary'] is Map ? Map<String, dynamic>.from(j['summary']) : {};
    return AttendanceData(
      list: (j['attendance'] as List? ?? [])
          .map((e) => AttendanceEntry.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      total: (s['total'] ?? 0) as int,
      present: (s['present'] ?? 0) as int,
      absent: (s['absent'] ?? 0) as int,
      excused: (s['excused'] ?? 0) as int,
      streak: (s['streak'] ?? 0) as int,
    );
  }
}

class PaymentEntry {
  final int? id;
  final num amount;
  final String method; // cash | upi
  final DateTime? date;
  final String? invoiceNumber;
  PaymentEntry({this.id, required this.amount, required this.method, this.date, this.invoiceNumber});
  factory PaymentEntry.fromJson(Map<String, dynamic> j) => PaymentEntry(
        id: j['id'] as int?,
        amount: _num(j['amount']) ?? 0,
        method: (j['method'] ?? 'cash') as String,
        date: Derive.parseDate(j['date']),
        invoiceNumber: j['invoiceNumber'] as String?,
      );
}
