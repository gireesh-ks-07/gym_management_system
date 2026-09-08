import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../network/api_client.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/attendance/presentation/attendance_screen.dart';
import '../../features/health/presentation/health_screen.dart';
import '../../features/payments/presentation/payments_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/workout/presentation/workout_screen.dart';
import '../../features/nutrition/presentation/nutrition_screen.dart';
import '../../features/nutrition/presentation/diet_chart_screen.dart';
import '../../features/pt/presentation/pt_screen.dart';
import '../../features/gamification/presentation/gamification_screen.dart';
import '../../features/gamification/presentation/leaderboard_screen.dart';
import '../../features/gamification/presentation/league_screen.dart';
import '../../features/gamification/presentation/challenges_screen.dart';
import '../../features/gamification/presentation/achievements_screen.dart';
import '../../features/gamification/presentation/streak_screen.dart';
import '../../features/gamification/presentation/rewards_screen.dart';
import '../../features/gamification/presentation/timeline_screen.dart';

// Instant cross-fade so tab switches don't slide a new screen over the old one.
CustomTransitionPage<void> _fade(Widget child, GoRouterState state) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    transitionDuration: const Duration(milliseconds: 180),
    reverseTransitionDuration: const Duration(milliseconds: 180),
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(opacity: animation, child: child);
    },
  );
}

GoRoute _route(String path, Widget child) => GoRoute(
      path: path,
      pageBuilder: (context, state) => _fade(child, state),
    );

// Route an expired session back to sign-in. The API client clears the token and
// calls this; without it a 401 surfaced as whatever error the screen happened to
// render, leaving the member stuck on a broken page.
void _handleSessionExpired() {
  final context = appRouter.routerDelegate.navigatorKey.currentContext;
  if (context != null) context.go('/login');
}

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    _route('/', const SplashScreen()),
    _route('/login', const LoginScreen()),
    _route('/dashboard', const DashboardScreen()),
    _route('/attendance', const AttendanceScreen()),
    _route('/health', const HealthScreen()),
    _route('/payments', const PaymentsScreen()),
    _route('/profile', const ProfileScreen()),
    _route('/workout', const WorkoutScreen()),
    _route('/nutrition', const NutritionScreen()),
    _route('/diet-plan', const DietChartScreen()),
    _route('/personal-training', const PtScreen()),
    _route('/gamification', const GamificationScreen()),
    _route('/gamification/leaderboard', const LeaderboardScreen()),
    _route('/gamification/league', const LeagueScreen()),
    _route('/gamification/challenges', const ChallengesScreen()),
    _route('/gamification/achievements', const AchievementsScreen()),
    _route('/gamification/streak', const StreakScreen()),
    _route('/gamification/rewards', const RewardsScreen()),
    _route('/gamification/timeline', const TimelineScreen()),
  ],
);

/// Registers the session-expiry hook once, at startup.
void wireSessionExpiry() {
  ApiClient.onSessionExpired = _handleSessionExpired;
}
