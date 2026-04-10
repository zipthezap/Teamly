import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A premium card with a subtle gradient background and border.
class UiCard extends StatelessWidget {
  const UiCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.gradient,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: gradient == null
            ? (isDark
                  ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                  : AppThemeTokens.lightCard.withValues(alpha: 0.98))
            : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(
          color: isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
        ),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// A gradient-backed primary action button.
class UiPrimaryButton extends StatelessWidget {
  const UiPrimaryButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.loading = false,
    this.fullWidth = true,
    this.icon,
  });

  final String text;
  final VoidCallback? onPressed;
  final bool loading;
  final bool fullWidth;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final inner = Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      child: InkWell(
        onTap: loading ? null : onPressed,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        splashColor: Colors.white.withValues(alpha: 0.1),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            gradient: onPressed == null || loading
                ? LinearGradient(
                    colors: [
                      AppThemeTokens.primary700.withValues(alpha: 0.5),
                      AppThemeTokens.primary700.withValues(alpha: 0.4),
                    ],
                  )
                : AppThemeTokens.primaryGradient,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          ),
          alignment: Alignment.center,
          child: loading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 18, color: Colors.white),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      text,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );

    return fullWidth ? SizedBox(width: double.infinity, child: inner) : inner;
  }
}

/// Section title with optional "see all" trailing action.
class UiSectionTitle extends StatelessWidget {
  const UiSectionTitle(
    this.text, {
    super.key,
    this.trailing,
    this.trailingLabel,
    this.onTrailingTap,
  });
  final String text;
  final Widget? trailing;
  final String? trailingLabel;
  final VoidCallback? onTrailingTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
        ),
        const Spacer(),
        if (trailing != null)
          trailing!
        else if (trailingLabel != null)
          GestureDetector(
            onTap: onTrailingTap,
            child: Text(
              trailingLabel!,
              style: const TextStyle(
                color: AppThemeTokens.primary400,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

/// Modern empty state with icon circle, title, message and optional action.
class UiEmptyState extends StatelessWidget {
  const UiEmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.title,
    this.action,
    this.actionLabel,
    this.actionIcon,
  });

  final IconData icon;
  final String message;
  final String? title;
  final VoidCallback? action;
  final String? actionLabel;
  final IconData? actionIcon;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final secondaryText =
        isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppThemeTokens.primary500.withValues(alpha: 0.2),
                    AppThemeTokens.primary700.withValues(alpha: 0.1),
                  ],
                ),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppThemeTokens.primary500.withValues(alpha: 0.25),
                  width: 1.5,
                ),
              ),
              child: Icon(icon, size: 36, color: AppThemeTokens.primary400),
            ),
            const SizedBox(height: 20),
            if (title != null) ...[
              Text(
                title!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: secondaryText,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            if (action != null && actionLabel != null) ...[
              const SizedBox(height: 24),
              UiPrimaryButton(
                text: actionLabel!,
                onPressed: action,
                fullWidth: false,
                icon: actionIcon ?? Icons.add,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Row with icon + text metadata, used in detail pages.
class UiInfoRow extends StatelessWidget {
  const UiInfoRow({
    super.key,
    required this.icon,
    required this.label,
    this.iconColor,
    this.value,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color? iconColor;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final secondaryText =
        isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
    final primaryText = isDark ? AppThemeTokens.darkText : AppThemeTokens.lightText;
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: (iconColor ?? AppThemeTokens.primary500).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: Icon(
              icon,
              size: 14,
              color: iconColor ?? AppThemeTokens.primary400,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: value != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                        Text(
                          label,
                          style: TextStyle(
                            color: secondaryText,
                            fontSize: 13,
                          ),
                        ),
                      Text(
                        value!,
                        style: TextStyle(
                          color: onTap != null
                              ? AppThemeTokens.primary400
                              : primaryText,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          decoration: onTap != null
                              ? TextDecoration.underline
                              : null,
                          decorationColor: AppThemeTokens.primary400,
                        ),
                      ),
                    ],
                  )
                : Text(
                    label,
                    style: TextStyle(
                      color: onTap != null
                          ? AppThemeTokens.primary400
                          : secondaryText,
                      fontSize: 13,
                      decoration:
                          onTap != null ? TextDecoration.underline : null,
                      decorationColor: AppThemeTokens.primary400,
                    ),
                  ),
          ),
          if (onTap != null) ...[
            const SizedBox(width: 4),
            Icon(Icons.open_in_new,
                size: 13, color: AppThemeTokens.primary400),
          ],
        ],
      ),
    );
    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        child: row,
      );
    }
    return row;
  }
}

/// Status badge mirroring the frontend's StatusBadge component.
enum UiStatusType { success, error, warning, info, defaultStatus }

class UiStatusBadge extends StatelessWidget {
  const UiStatusBadge({
    super.key,
    required this.label,
    this.status = UiStatusType.defaultStatus,
    this.customColor,
    this.dot = false,
  });

  final String label;
  final UiStatusType status;
  final Color? customColor;
  final bool dot;

  static UiStatusType fromString(String s) {
    switch (s.toLowerCase()) {
      case 'confirmed':
      case 'success':
      case 'on_time':
      case 'on-time':
      case 'accepted':
      case 'active':
      case 'in_progress':
      case 'completed':
        return UiStatusType.success;
      case 'pending':
      case 'warning':
      case 'late':
      case 'registration':
        return UiStatusType.warning;
      case 'declined':
      case 'error':
      case 'rejected':
      case 'cancelled':
        return UiStatusType.error;
      case 'invited':
      case 'info':
      case 'draft':
        return UiStatusType.info;
      default:
        return UiStatusType.defaultStatus;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final Color fg;
    final Color bg;
    if (customColor != null) {
      fg = customColor!;
      bg = customColor!.withValues(alpha: 0.15);
    } else {
      switch (status) {
        case UiStatusType.success:
          fg = AppThemeTokens.success;
          bg = AppThemeTokens.success.withValues(alpha: 0.12);
          break;
        case UiStatusType.warning:
          fg = AppThemeTokens.warning;
          bg = AppThemeTokens.warning.withValues(alpha: 0.12);
          break;
        case UiStatusType.error:
          fg = AppThemeTokens.error;
          bg = AppThemeTokens.error.withValues(alpha: 0.12);
          break;
        case UiStatusType.info:
          fg = AppThemeTokens.info;
          bg = AppThemeTokens.info.withValues(alpha: 0.12);
          break;
        case UiStatusType.defaultStatus:
          fg = isDark ? AppThemeTokens.darkTextSecondary : AppThemeTokens.lightTextSecondary;
          bg = isDark ? AppThemeTokens.darkCardHover : AppThemeTokens.lightCardHover;
          break;
      }
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: fg.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: fg,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

/// A shimmer-style loading placeholder.
class UiSkeletonBox extends StatelessWidget {
  const UiSkeletonBox({super.key, this.height = 16, this.width, this.radius});
  final double height;
  final double? width;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: isDark ? AppThemeTokens.darkCardHover : AppThemeTokens.lightCardHover,
        borderRadius: BorderRadius.circular(radius ?? AppThemeTokens.radiusSm),
      ),
    );
  }
}

/// Divider with optional label.
class UiLabeledDivider extends StatelessWidget {
  const UiLabeledDivider(this.label, {super.key});
  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        const Expanded(child: Divider()),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: TextStyle(
              color: isDark ? AppThemeTokens.darkTextMuted : AppThemeTokens.lightTextMuted,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const Expanded(child: Divider()),
      ],
    );
  }
}
