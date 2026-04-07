import 'package:flutter/material.dart';
import 'package:styled_widget/styled_widget.dart';

import '../../core/theme/app_theme.dart';

class UiCard extends StatelessWidget {
  const UiCard(
      {super.key,
      required this.child,
      this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: child.decorated(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
    );
  }
}

class UiPrimaryButton extends StatelessWidget {
  const UiPrimaryButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.loading = false,
    this.fullWidth = true,
  });

  final String text;
  final VoidCallback? onPressed;
  final bool loading;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton(
      onPressed: loading ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        backgroundColor: AppThemeTokens.primary500,
        disabledBackgroundColor: AppThemeTokens.primary700.withOpacity(0.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        ),
      ),
      child: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white),
            )
          : Text(text),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class UiSectionTitle extends StatelessWidget {
  const UiSectionTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context)
          .textTheme
          .titleMedium
          ?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: AppThemeTokens.primary500.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
            border: Border.all(
              color: AppThemeTokens.darkBorder,
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppThemeTokens.primary500.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 40, color: AppThemeTokens.primary500),
              ),
              const SizedBox(height: 16),
              if (title != null) ...[
                Text(
                  title!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppThemeTokens.darkText,
                      ),
                ),
                const SizedBox(height: 6),
              ],
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: AppThemeTokens.darkTextSecondary, fontSize: 14),
              ),
              if (action != null && actionLabel != null) ...[
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: action,
                  icon: Icon(actionIcon ?? Icons.add),
                  label: Text(actionLabel!),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppThemeTokens.primary500,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class UiInfoRow extends StatelessWidget {
  const UiInfoRow({
    super.key,
    required this.icon,
    required this.label,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            icon,
            size: 16,
            color: iconColor ?? AppThemeTokens.darkTextSecondary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                  color: AppThemeTokens.darkTextSecondary, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// Status badge mirroring the frontend's StatusBadge component.
/// Maps semantic status strings to consistent pill-shaped color indicators.
enum UiStatusType { success, error, warning, info, defaultStatus }

class UiStatusBadge extends StatelessWidget {
  const UiStatusBadge({
    super.key,
    required this.label,
    this.status = UiStatusType.defaultStatus,
    this.customColor,
  });

  final String label;
  final UiStatusType status;
  final Color? customColor;

  static UiStatusType fromString(String s) {
    switch (s.toLowerCase()) {
      case 'confirmed':
      case 'success':
      case 'on_time':
      case 'on-time':
      case 'accepted':
        return UiStatusType.success;
      case 'pending':
      case 'warning':
      case 'late':
        return UiStatusType.warning;
      case 'declined':
      case 'error':
      case 'rejected':
        return UiStatusType.error;
      case 'invited':
      case 'info':
        return UiStatusType.info;
      default:
        return UiStatusType.defaultStatus;
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color fg;
    final Color bg;
    if (customColor != null) {
      fg = customColor!;
      bg = customColor!.withValues(alpha: 0.15);
    } else {
      switch (status) {
        case UiStatusType.success:
          fg = AppThemeTokens.success;
          bg = AppThemeTokens.success.withValues(alpha: 0.15);
          break;
        case UiStatusType.warning:
          fg = AppThemeTokens.warning;
          bg = AppThemeTokens.warning.withValues(alpha: 0.15);
          break;
        case UiStatusType.error:
          fg = AppThemeTokens.error;
          bg = AppThemeTokens.error.withValues(alpha: 0.15);
          break;
        case UiStatusType.info:
          fg = AppThemeTokens.info;
          bg = AppThemeTokens.info.withValues(alpha: 0.15);
          break;
        case UiStatusType.defaultStatus:
          fg = AppThemeTokens.darkTextSecondary;
          bg = AppThemeTokens.darkCardHover;
          break;
      }
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
