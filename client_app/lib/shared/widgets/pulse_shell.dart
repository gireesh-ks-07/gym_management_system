import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../core/theme/pulse_colors.dart';
import 'pulse_glass_card.dart';
import 'pulse_background.dart';

class PulseShell extends StatelessWidget {
  final Widget child;
  final String? title;
  final String? backRoute;
  final Widget? rightAction;
  final bool showBottomNav;
  final ScrollController? scrollController;
  final Widget? floatingAction;

  const PulseShell({
    super.key,
    required this.child,
    this.title,
    this.backRoute,
    this.rightAction,
    this.showBottomNav = true,
    this.scrollController,
    this.floatingAction,
  });

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: PulseColors.background,
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          // Background hero radial gradients (matches reference --gradient-hero)
          const Positioned.fill(child: PulseBackground()),

          // Main content
          SafeArea(
            bottom: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 500),
                width: double.infinity,
                child: Column(
                  children: [
                    if (title != null) _buildHeader(context),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: scrollController,
                        physics: const BouncingScrollPhysics(),
                        padding: EdgeInsets.only(
                          left: 16,
                          right: 16,
                          top: title == null ? 16 : 4,
                          bottom: showBottomNav ? 96 + bottomInset : 24,
                        ),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Floating action (e.g. QR check-in) above the oval nav
          if (floatingAction != null)
            Positioned(
              right: 22,
              bottom: (showBottomNav ? 88 : 24) + bottomInset,
              child: floatingAction!,
            ),

          // Floating transparent oval navigation bar (fixed)
          if (showBottomNav)
            Positioned(
              left: 0,
              right: 0,
              bottom: 12 + bottomInset,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 468),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _buildOvalNav(context, location),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (backRoute != null)
            PulseGlassCard(
              padding: EdgeInsets.zero,
              borderRadius: 14,
              onTap: () => context.go(backRoute!),
              child: const SizedBox(
                width: 40,
                height: 40,
                child: Icon(Iconsax.arrow_left_2, size: 18),
              ),
            )
          else
            const SizedBox(width: 40, height: 40),
          Expanded(
            child: Text(
              title!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          rightAction ?? const SizedBox(width: 40, height: 40),
        ],
      ),
    );
  }

  // Transparent glass oval — floats over the page, blurring content behind it.
  Widget _buildOvalNav(BuildContext context, String currentLocation) {
    final navItems = [
      _NavBarItem(route: '/dashboard', label: 'Home', icon: Iconsax.home_1),
      _NavBarItem(route: '/attendance', label: 'Attend', icon: Iconsax.calendar_tick),
      _NavBarItem(route: '/gamification', label: 'Rewards', icon: Iconsax.cup),
      _NavBarItem(route: '/health', label: 'Health', icon: Iconsax.heart),
      _NavBarItem(route: '/payments', label: 'Pay', icon: Iconsax.card),
      _NavBarItem(route: '/profile', label: 'Profile', icon: Iconsax.user),
    ];

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          height: 66,
          decoration: BoxDecoration(
            color: PulseColors.popover.withOpacity(0.55),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: Colors.white.withOpacity(0.12), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.35),
                blurRadius: 30,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: navItems.map((item) {
              final isSelected = currentLocation == item.route;
              return Expanded(
                child: GestureDetector(
                  onTap: isSelected ? null : () => context.go(item.route),
                  behavior: HitTestBehavior.opaque,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3, vertical: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
                    decoration: isSelected
                        ? BoxDecoration(
                            gradient: PulseColors.primaryGradient,
                            borderRadius: BorderRadius.circular(999),
                          )
                        : const BoxDecoration(color: Colors.transparent),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          item.icon,
                          size: 19,
                          color: isSelected ? Colors.white : PulseColors.textMuted,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                            color: isSelected ? Colors.white : PulseColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _NavBarItem {
  final String route;
  final String label;
  final IconData icon;

  _NavBarItem({
    required this.route,
    required this.label,
    required this.icon,
  });
}
