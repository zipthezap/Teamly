import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Vector-drawn Teamly logo that reproduces the frontend SVG (logo.svg).
///
/// The SVG consists of:
///   - A filled dark circle (#1a2233) with a blue stroke (#2563eb)
///   - A top arc in sky-blue (#38bdf8)
///   - A bottom arc in cyan (#22d3ee)
///   - A filled center dot (#2563eb)
///
/// Use [size] to scale uniformly; the painter uses a 120×120 viewBox.
class TeamlyLogo extends StatelessWidget {
  const TeamlyLogo({
    super.key,
    this.size = 48,
    this.withShadow = false,
  });

  final double size;
  final bool withShadow;

  @override
  Widget build(BuildContext context) {
    final logo = CustomPaint(
      size: Size(size, size),
      painter: _TeamlyLogoPainter(),
    );

    if (!withShadow) return logo;

    return DecoratedBox(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: AppThemeTokens.primary500.withValues(alpha: 0.35),
            blurRadius: size * 0.4,
            offset: Offset(0, size * 0.1),
          ),
        ],
        shape: BoxShape.circle,
      ),
      child: logo,
    );
  }
}

class _TeamlyLogoPainter extends CustomPainter {
  // SVG viewBox is 0 0 120 120 → map to [0, 1] then scale to canvas size.
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 120.0; // uniform scale factor

    // 1. Outer filled circle (dark fill + blue stroke)
    final bgPaint = Paint()..color = const Color(0xFF1A2233);
    canvas.drawCircle(Offset(60 * s, 60 * s), 54 * s, bgPaint);

    final strokePaint = Paint()
      ..color = const Color(0xFF2563EB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8 * s
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(Offset(60 * s, 60 * s), 54 * s, strokePaint);

    // 2. Top arc — "M40 60 a20 20 0 1 1 40 0" = top half of r=20 circle centred at (60,60)
    final arcPaint = Paint()
      ..color = const Color(0xFF38BDF8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8 * s
      ..strokeCap = StrokeCap.round;

    final topArcRect = Rect.fromCenter(
      center: Offset(60 * s, 60 * s),
      width: 40 * s,
      height: 40 * s,
    );
    // From angle π (left) sweeping -π (i.e. top half anti-clockwise to right)
    canvas.drawArc(topArcRect, math.pi, -math.pi, false, arcPaint);

    // 3. Bottom arc — "M60 80 a20 20 0 1 1 0-40" = bottom half of r=20 circle
    final botArcPaint = Paint()
      ..color = const Color(0xFF22D3EE)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8 * s
      ..strokeCap = StrokeCap.round;

    final botArcRect = Rect.fromCenter(
      center: Offset(60 * s, 60 * s),
      width: 40 * s,
      height: 40 * s,
    );
    // Start at bottom (π/2 * 3 = 270°) and sweep -π (bottom half going right→left)
    canvas.drawArc(botArcRect, math.pi / 2, -math.pi, false, botArcPaint);

    // 4. Center dot
    final dotPaint = Paint()..color = const Color(0xFF2563EB);
    canvas.drawCircle(Offset(60 * s, 60 * s), 10 * s, dotPaint);
  }

  @override
  bool shouldRepaint(_TeamlyLogoPainter oldDelegate) => false;
}
