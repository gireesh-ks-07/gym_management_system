import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/pulse_colors.dart';
import 'core/theme/theme_controller.dart';
import 'core/router/app_router.dart';

void main() {
  wireSessionExpiry();
  runApp(
    const ProviderScope(
      child: ClientApp(),
    ),
  );
}

class ClientApp extends ConsumerStatefulWidget {
  const ClientApp({super.key});

  @override
  ConsumerState<ClientApp> createState() => _ClientAppState();
}

class _ClientAppState extends ConsumerState<ClientApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Rebuild when the OS light/dark setting changes (matters in System mode).
  @override
  void didChangePlatformBrightness() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final mode = ref.watch(themeModeProvider);

    // Resolve the brightness actually in effect, then sync PulseColors BEFORE
    // the widget tree builds so every screen reads the right neutral tokens.
    final systemBrightness =
        WidgetsBinding.instance.platformDispatcher.platformBrightness;
    final brightness = switch (mode) {
      ThemeMode.light => Brightness.light,
      ThemeMode.dark => Brightness.dark,
      ThemeMode.system => systemBrightness,
    };
    PulseColors.apply(brightness);

    return MaterialApp.router(
      title: 'Gym Client App',
      theme: AppTheme.themeFor(brightness),
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}
