import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import '../../../core/theme/pulse_colors.dart';
import '../../../shared/widgets/pulse_background.dart';
import '../../member/data/member_controller.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final id = _emailController.text.trim();
    final pw = _passwordController.text;
    if (id.isEmpty || pw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your mobile/email and password')),
      );
      return;
    }
    final ok = await ref.read(authControllerProvider.notifier).login(id, pw);
    if (!mounted) return;
    if (ok) {
      ref.invalidate(meProvider); // fetch fresh member data
      context.go('/dashboard');
    } else {
      final err = ref.read(authControllerProvider).error;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(err?.toString() ?? 'Login failed'),
          backgroundColor: PulseColors.destructive,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PulseColors.background,
      body: Stack(
        children: [
          const Positioned.fill(child: PulseBackground()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 390),
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Hero illustration
                      Center(
                        child: Image.asset(
                          'assets/images/login-illustration.png',
                          height: 210,
                          fit: BoxFit.contain,
                        ),
                      ).animate().fadeIn(duration: 500.ms).slideY(begin: 0.08, end: 0),
                      const SizedBox(height: 8),
                      Text(
                        'Welcome back',
                        style: TextStyle(
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -1.0,
                          color: PulseColors.foreground,
                        ),
                      ).animate().fadeIn(delay: 80.ms),
                      const SizedBox(height: 8),
                      Text(
                        'Log in to continue your streak at PulseFit.',
                        style: TextStyle(
                          fontSize: 17,
                          height: 1.4,
                          color: PulseColors.foreground.withOpacity(0.55),
                        ),
                      ).animate().fadeIn(delay: 120.ms),
                      const SizedBox(height: 28),

                      // Mobile / email
                      _fieldLabel('Mobile number or email'),
                      const SizedBox(height: 10),
                      _PillField(
                        controller: _emailController,
                        icon: Iconsax.sms,
                        keyboardType: TextInputType.emailAddress,
                        hint: 'you@email.com or 98765 43210',
                      ),
                      const SizedBox(height: 20),

                      // Password
                      _fieldLabel('Password'),
                      const SizedBox(height: 10),
                      _PillField(
                        controller: _passwordController,
                        icon: Iconsax.lock_1,
                        obscure: _obscurePassword,
                        hint: 'Your password',
                        trailing: GestureDetector(
                          onTap: () => setState(
                              () => _obscurePassword = !_obscurePassword),
                          child: Icon(
                            _obscurePassword ? Iconsax.eye : Iconsax.eye_slash,
                            size: 20,
                            color: PulseColors.textMuted,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Remember me + forgot
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          GestureDetector(
                            onTap: () =>
                                setState(() => _rememberMe = !_rememberMe),
                            behavior: HitTestBehavior.opaque,
                            child: Row(
                              children: [
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 150),
                                  width: 24,
                                  height: 24,
                                  decoration: BoxDecoration(
                                    gradient: _rememberMe
                                        ? PulseColors.primaryGradient
                                        : null,
                                    color: _rememberMe ? null : PulseColors.input,
                                    borderRadius: BorderRadius.circular(999),
                                    border: _rememberMe
                                        ? null
                                        : Border.all(color: PulseColors.border),
                                  ),
                                  child: _rememberMe
                                      ? const Icon(Icons.check,
                                          size: 15, color: Colors.white)
                                      : null,
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Remember me',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w500,
                                    color:
                                        PulseColors.foreground.withOpacity(0.85),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Text(
                            'Forgot password?',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: PulseColors.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 22),

                      // Log in button
                      _GradientButton(
                        label: 'Log in',
                        loading: ref.watch(authControllerProvider).isLoading,
                        onTap: _submit,
                      ),
                      const SizedBox(height: 22),

                      // divider
                      Row(
                        children: [
                          Expanded(child: Divider(color: PulseColors.border)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              'or continue with',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: PulseColors.textMuted,
                              ),
                            ),
                          ),
                          Expanded(child: Divider(color: PulseColors.border)),
                        ],
                      ),
                      const SizedBox(height: 20),

                      _OutlineButton(
                        onTap: () {},
                        leading: const Text(
                          'G',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFEA4335),
                          ),
                        ),
                        label: 'Log in with Google',
                      ),
                      const SizedBox(height: 14),
                      _OutlineButton(
                        onTap: () {},
                        leading: Icon(Iconsax.call,
                            size: 20, color: PulseColors.textMuted),
                        label: 'Contact your gym',
                      ),
                      const SizedBox(height: 22),

                      Text.rich(
                        TextSpan(
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.4,
                            color: PulseColors.textMuted,
                          ),
                          children: const [
                            TextSpan(text: 'By continuing you agree to our '),
                            TextSpan(
                              text: 'Terms',
                              style: TextStyle(
                                  color: PulseColors.primary,
                                  fontWeight: FontWeight.w600),
                            ),
                            TextSpan(text: ' and '),
                            TextSpan(
                              text: 'Privacy Policy',
                              style: TextStyle(
                                  color: PulseColors.primary,
                                  fontWeight: FontWeight.w600),
                            ),
                            TextSpan(text: '.'),
                          ],
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(
        text,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: PulseColors.foreground.withOpacity(0.8),
        ),
      );
}

class _PillField extends StatelessWidget {
  final TextEditingController controller;
  final IconData icon;
  final bool obscure;
  final Widget? trailing;
  final TextInputType? keyboardType;
  final String? hint;

  const _PillField({
    required this.controller,
    required this.icon,
    this.obscure = false,
    this.trailing,
    this.keyboardType,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: PulseColors.input,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: PulseColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: PulseColors.primary),
          const SizedBox(width: 14),
          Expanded(
            child: TextField(
              controller: controller,
              obscureText: obscure,
              keyboardType: keyboardType,
              cursorColor: PulseColors.primary,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: PulseColors.foreground,
              ),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                hintText: hint,
                hintStyle: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: PulseColors.textMuted.withOpacity(0.7),
                ),
              ),
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool loading;
  const _GradientButton({required this.label, required this.onTap, this.loading = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        height: 60,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: PulseColors.primaryGradient,
          borderRadius: BorderRadius.circular(999),
          boxShadow: [
            BoxShadow(
              color: PulseColors.primary.withOpacity(0.4),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }
}

class _OutlineButton extends StatelessWidget {
  final Widget leading;
  final String label;
  final VoidCallback onTap;
  const _OutlineButton({
    required this.leading,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 60,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: PulseColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            leading,
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: PulseColors.foreground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
