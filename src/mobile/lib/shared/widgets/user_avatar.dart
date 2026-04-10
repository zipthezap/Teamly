import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Displays a user avatar from a URL, falling back to a gradient initials circle.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.name,
    this.imageUrl,
    this.radius = 20,
    this.borderColor,
  });

  final String name;
  final String? imageUrl;
  final double radius;
  final Color? borderColor;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  /// Generate a deterministic accent color from the name.
  Color _accentColor() {
    final palette = [
      const Color(0xFF2196F3), // blue
      const Color(0xFF7C4DFF), // purple
      const Color(0xFF00BCD4), // teal
      const Color(0xFF4CAF50), // green
      const Color(0xFFFF9800), // orange
      const Color(0xFFF44336), // red
      const Color(0xFFE91E63), // pink
      const Color(0xFF009688), // teal dark
    ];
    final idx = name.codeUnits.fold(0, (a, b) => a + b) % palette.length;
    return palette[idx];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = _accentColor();
    final hasBorder = borderColor != null;

    Widget avatar;

    if (imageUrl != null && imageUrl!.isNotEmpty) {
      avatar = CircleAvatar(
        radius: radius,
        backgroundImage: NetworkImage(imageUrl!),
        onBackgroundImageError: (_, __) {},
        backgroundColor: isDark ? AppThemeTokens.darkCardHover : AppThemeTokens.lightCardHover,
      );
    } else {
      avatar = Container(
        width: radius * 2,
        height: radius * 2,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              accent,
              accent.withValues(alpha: 0.6),
            ],
          ),
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(
            _initials,
            style: TextStyle(
              fontSize: radius * 0.72,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 0.5,
            ),
          ),
        ),
      );
    }

    if (!hasBorder) return avatar;

    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: borderColor!, width: 2),
      ),
      child: avatar,
    );
  }
}
