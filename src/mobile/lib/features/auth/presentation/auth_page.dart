import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/error_utils.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/teamly_logo.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../state/auth_notifier.dart';

class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({super.key});

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();

  bool _isRegister = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _showForgotPassword() async {
    final emailCtrl = TextEditingController(text: _emailCtrl.text.trim());
    final formKey = GlobalKey<FormState>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Password'),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: emailCtrl,
            decoration: const InputDecoration(
              labelText: 'Email address',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Email is required';
              final r = RegExp(r'^[^@]+@[^@]+\.[^@]+');
              if (!r.hasMatch(v.trim())) return 'Enter a valid email';
              return null;
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.of(ctx).pop(true);
              }
            },
            child: const Text('Send Reset Link'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final dio = ref.read(dioProvider);
      await dio.post<void>(
        '/auth/forgot-password',
        data: {'email': emailCtrl.text.trim()},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('If an account exists, a reset link has been sent.'),
          ),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      emailCtrl.dispose();
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final notifier = ref.read(authNotifierProvider.notifier);
    if (_isRegister) {
      await notifier.register(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
        name: _nameCtrl.text.trim(),
      );
    } else {
      await notifier.login(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
    }

    if (!mounted) return;
    final state = ref.read(authNotifierProvider);
    if (state.isAuthenticated) {
      context.go('/dashboard');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    ref.listen<AuthState>(authNotifierProvider, (_, next) {
      if (next.isAuthenticated && mounted) {
        context.go('/dashboard');
        return;
      }
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.error!),
            backgroundColor: AppThemeTokens.error,
          ),
        );
        ref.read(authNotifierProvider.notifier).clearError();
      }
    });

    return Scaffold(
      backgroundColor: AppThemeTokens.darkBg,
      body: Stack(
        children: [
          // Background gradient circles
          Positioned(
            top: -80,
            right: -60,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppThemeTokens.primary500.withValues(alpha: 0.06),
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            left: -80,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppThemeTokens.primary700.withValues(alpha: 0.05),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo
                    const TeamlyLogo(size: 80, withShadow: true),
                    const SizedBox(height: 20),
                    const Text(
                      'Teamly',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: AppThemeTokens.darkText,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 250),
                      child: Text(
                        _isRegister ? 'Create your account' : 'Welcome back',
                        key: ValueKey(_isRegister),
                        style: const TextStyle(
                          fontSize: 15,
                          color: AppThemeTokens.darkTextSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Form card
                    Container(
                      decoration: BoxDecoration(
                        color: AppThemeTokens.darkCard,
                        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
                        border: Border.all(color: AppThemeTokens.darkBorder),
                      ),
                      padding: const EdgeInsets.all(24),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AnimatedSize(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeInOut,
                              child: _isRegister
                                  ? Column(
                                      children: [
                                        TextFormField(
                                          controller: _nameCtrl,
                                          decoration: const InputDecoration(
                                            labelText: 'Full name',
                                            prefixIcon: Icon(Icons.person_rounded),
                                          ),
                                          textCapitalization: TextCapitalization.words,
                                          validator: (v) {
                                            if (v == null || v.trim().isEmpty) return 'Name is required';
                                            if (v.trim().length < 2) return 'At least 2 characters';
                                            return null;
                                          },
                                        ),
                                        const SizedBox(height: 14),
                                      ],
                                    )
                                  : const SizedBox.shrink(),
                            ),
                            TextFormField(
                              controller: _emailCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Email address',
                                prefixIcon: Icon(Icons.email_rounded),
                              ),
                              keyboardType: TextInputType.emailAddress,
                              autocorrect: false,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) return 'Email is required';
                                final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+');
                                if (!emailRegex.hasMatch(v.trim())) return 'Enter a valid email';
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _passwordCtrl,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                prefixIcon: const Icon(Icons.lock_rounded),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                                    size: 20,
                                  ),
                                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                ),
                              ),
                              obscureText: _obscurePassword,
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Password is required';
                                if (_isRegister && v.length < 8) return 'At least 8 characters';
                                return null;
                              },
                            ),
                            const SizedBox(height: 24),
                            UiPrimaryButton(
                              text: _isRegister ? 'Create Account' : 'Sign In',
                              loading: authState.isLoading,
                              onPressed: authState.isLoading ? null : _submit,
                              icon: _isRegister ? Icons.person_add_rounded : Icons.login_rounded,
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Social login divider
                    Row(
                      children: [
                        const Expanded(child: Divider(color: AppThemeTokens.darkBorder)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'or continue with',
                            style: TextStyle(
                              color: AppThemeTokens.darkTextSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider(color: AppThemeTokens.darkBorder)),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Social login buttons
                    Column(
                      children: [
                        _SocialButton(
                          label: 'Continue with Google',
                          icon: _GoogleIcon(),
                          loading: authState.isLoading,
                          onPressed: authState.isLoading
                              ? null
                              : () => ref.read(authNotifierProvider.notifier).loginWithGoogle(),
                        ),
                        const SizedBox(height: 10),
                        _SocialButton(
                          label: 'Continue with Facebook',
                          icon: const _FacebookIcon(),
                          loading: authState.isLoading,
                          onPressed: authState.isLoading
                              ? null
                              : () => ref.read(authNotifierProvider.notifier).loginWithFacebook(),
                        ),
                        // Apple Sign-In is only shown on Apple platforms (iOS / macOS)
                        if (!kIsWeb &&
                            (defaultTargetPlatform == TargetPlatform.iOS ||
                                defaultTargetPlatform == TargetPlatform.macOS)) ...[
                          const SizedBox(height: 10),
                          _SocialButton(
                            label: 'Continue with Apple',
                            icon: const _AppleIcon(),
                            loading: authState.isLoading,
                            onPressed: authState.isLoading
                                ? null
                                : () => ref.read(authNotifierProvider.notifier).loginWithApple(),
                          ),
                        ],
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Toggle login/register
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _isRegister ? 'Already have an account?' : "Don't have an account?",
                          style: const TextStyle(
                            color: AppThemeTokens.darkTextSecondary,
                            fontSize: 14,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(() => _isRegister = !_isRegister);
                            _formKey.currentState?.reset();
                          },
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            _isRegister ? 'Sign in' : 'Create one',
                            style: const TextStyle(
                              color: AppThemeTokens.primary400,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),

                    if (!_isRegister)
                      TextButton(
                        onPressed: _showForgotPassword,
                        child: const Text(
                          'Forgot password?',
                          style: TextStyle(
                            color: AppThemeTokens.darkTextSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Social login helper widgets
// ---------------------------------------------------------------------------

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final Widget icon;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: loading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: AppThemeTokens.darkBorder),
          backgroundColor: AppThemeTokens.darkCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
        child: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(width: 22, height: 22, child: icon),
                  const SizedBox(width: 10),
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppThemeTokens.darkText,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// A simple hand-painted Google 'G' logo using [CustomPainter].
class _GoogleIcon extends StatelessWidget {
  const _GoogleIcon();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(22, 22), painter: _GoogleLogoPainter());
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width / 2;

    // Clip to circle
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: Offset(cx, cy), radius: r)));

    // White background
    canvas.drawCircle(Offset(cx, cy), r, Paint()..color = Colors.white);

    // Draw the four colour arcs that make up the Google 'G'
    const strokeW = 3.5;
    final rect = Rect.fromCircle(center: Offset(cx, cy), radius: r * 0.68);

    void arc(double startDeg, double sweepDeg, Color color) {
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeW
        ..strokeCap = StrokeCap.butt;
      final startRad = startDeg * 3.14159 / 180;
      final sweepRad = sweepDeg * 3.14159 / 180;
      canvas.drawArc(rect, startRad, sweepRad, false, paint);
    }

    arc(-10, 100, const Color(0xFF4285F4)); // blue  – top-right
    arc(90, 100, const Color(0xFF34A853));  // green – bottom
    arc(190, 90, const Color(0xFFFBBC05));  // yellow – bottom-left
    arc(280, 80, const Color(0xFFEA4335)); // red   – top-left

    // Blue horizontal bar of the 'G'
    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..strokeWidth = strokeW
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(cx, cy),
      Offset(cx + r * 0.62, cy),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Facebook 'f' icon drawn with CustomPainter.
class _FacebookIcon extends StatelessWidget {
  const _FacebookIcon();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(22, 22), painter: _FacebookLogoPainter());
  }
}

class _FacebookLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width / 2;

    // Blue circle background
    canvas.drawCircle(
      Offset(cx, cy),
      r,
      Paint()..color = const Color(0xFF1877F2),
    );

    // White 'f' letter
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    // Vertical bar of 'f'
    final barLeft = cx - r * 0.08;
    final barTop = cy - r * 0.65;
    final barWidth = r * 0.22;
    final barBottom = cy + r * 0.72;
    canvas.drawRect(
      Rect.fromLTRB(barLeft, barTop, barLeft + barWidth, barBottom),
      paint,
    );

    // Crossbar of 'f'
    final crossTop = cy - r * 0.1;
    final crossLeft = barLeft - r * 0.22;
    final crossRight = barLeft + barWidth + r * 0.12;
    canvas.drawRect(
      Rect.fromLTRB(crossLeft, crossTop, crossRight, crossTop + barWidth),
      paint,
    );

    // Top curve of 'f' (rounded head)
    final headRadius = r * 0.3;
    canvas.drawCircle(
      Offset(barLeft + barWidth / 2, barTop + headRadius),
      headRadius,
      paint,
    );
    // Erase the inner part to make it a partial circle / just a rounded cap
    canvas.drawRect(
      Rect.fromLTRB(
          barLeft, barTop + headRadius, barLeft + barWidth, barTop + headRadius * 2),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Apple logo icon using an Icon widget (available via Material icons set).
class _AppleIcon extends StatelessWidget {
  const _AppleIcon();

  @override
  Widget build(BuildContext context) {
    // Use a simple icon representation. The Apple brand icon is not in
    // Material icons, so we draw a stylised apple shape with CustomPainter.
    return CustomPaint(size: const Size(22, 22), painter: _AppleLogoPainter());
  }
}

class _AppleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final paint = Paint()
      ..color = AppThemeTokens.darkText
      ..style = PaintingStyle.fill;

    // Draw a simple Apple-like silhouette using a Path.
    final path = Path();
    // Apple body (rough approximation)
    path.moveTo(w * 0.50, h * 0.18);
    path.cubicTo(w * 0.62, h * 0.04, w * 0.88, h * 0.10, w * 0.88, h * 0.38);
    path.cubicTo(w * 0.88, h * 0.62, w * 0.78, h * 0.78, w * 0.66, h * 0.88);
    path.cubicTo(w * 0.57, h * 0.96, w * 0.50, h * 0.96, w * 0.50, h * 0.96);
    path.cubicTo(w * 0.50, h * 0.96, w * 0.43, h * 0.96, w * 0.34, h * 0.88);
    path.cubicTo(w * 0.22, h * 0.78, w * 0.12, h * 0.62, w * 0.12, h * 0.38);
    path.cubicTo(w * 0.12, h * 0.10, w * 0.38, h * 0.04, w * 0.50, h * 0.18);
    path.close();
    canvas.drawPath(path, paint);

    // Leaf / stem
    final stemPath = Path();
    stemPath.moveTo(w * 0.50, h * 0.18);
    stemPath.cubicTo(w * 0.50, h * 0.08, w * 0.60, h * 0.02, w * 0.66, h * 0.06);
    stemPath.cubicTo(w * 0.60, h * 0.10, w * 0.52, h * 0.14, w * 0.50, h * 0.18);
    stemPath.close();
    canvas.drawPath(stemPath, paint);

    // Bite out of the right side (white eraser circle)
    canvas.drawCircle(
      Offset(w * 0.78, h * 0.28),
      w * 0.18,
      Paint()
        ..color = AppThemeTokens.darkCard
        ..style = PaintingStyle.fill,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
