import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../tournament_status_presentation.dart';

/// Small reusable presentational widgets shared across the tournament detail
/// page's tabs (overview, teams, matches). Extracted from
/// `tournament_detail_page.dart` to keep that file focused on tab/page
/// composition rather than leaf-widget styling.
class PaymentStatusBadge extends StatelessWidget {
  const PaymentStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    String label;
    switch (status) {
      case 'paid':
        color = Colors.green;
        icon = Icons.check_circle_outline;
        label = 'Paid';
        break;
      case 'waived':
        color = Colors.blue;
        icon = Icons.do_not_disturb_alt_outlined;
        label = 'Fee Waived';
        break;
      case 'pending':
        color = Colors.orange;
        icon = Icons.schedule_outlined;
        label = 'Payment Pending';
        break;
      default:
        color = Colors.red;
        icon = Icons.money_off_outlined;
        label = 'Unpaid';
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                fontSize: 12, color: color, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class StandingStatChip extends StatelessWidget {
  const StandingStatChip({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppThemeTokens.cardElevated(context),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppThemeTokens.border(context)),
      ),
      child: RichText(
        text: TextSpan(
          style: TextStyle(
            color: AppThemeTokens.textSecondary(context),
            fontSize: 12,
          ),
          children: [
            TextSpan(text: '$label '),
            TextSpan(
              text: value,
              style: TextStyle(
                color: AppThemeTokens.textSecondary(context),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final statusPresentation = getTournamentStatusPresentation(status: status);
    final statusColor = statusPresentation.color;
    final bgColor = statusPresentation.backgroundColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: statusColor.withValues(alpha: 0.3))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusPresentation.icon, size: 12, color: statusColor),
          const SizedBox(width: 4),
          Text(statusPresentation.label,
              style: TextStyle(
                  color: statusColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class InfoCard extends StatelessWidget {
  const InfoCard({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Padding(
          padding: const EdgeInsets.all(12), child: Column(children: children)),
    );
  }
}

class InfoRow extends StatelessWidget {
  const InfoRow(
      {super.key,
      required this.icon,
      required this.label,
      required this.value,
      this.onTap});

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppThemeTokens.textMuted(context)),
          const SizedBox(width: 8),
          Text('$label: ',
              style: TextStyle(
                  color: AppThemeTokens.textSecondary(context), fontSize: 13)),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontSize: 13),
                  overflow: TextOverflow.ellipsis)),
          if (onTap != null)
            Icon(Icons.chevron_right,
                size: 16, color: AppThemeTokens.textMuted(context)),
        ],
      ),
    );
    if (onTap != null) {
      return InkWell(
          onTap: onTap, borderRadius: BorderRadius.circular(4), child: row);
    }
    return row;
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
          color: AppThemeTokens.card(context),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.border(context))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 6),
          child,
        ]),
      ),
    );
  }
}

class RadioOption<T> extends StatelessWidget {
  const RadioOption({
    super.key,
    required this.label,
    this.sublabel,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  final String label;
  final String? sublabel;
  final T value;
  final T groupValue;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(value),
      borderRadius: BorderRadius.circular(8),
      child: Row(
        children: [
          Radio<T>(value: value, groupValue: groupValue, onChanged: onChanged),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w500)),
                if (sublabel != null)
                  Text(sublabel!,
                      style: TextStyle(
                          fontSize: 11,
                          color:
                              Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class TeamCardStatChip extends StatelessWidget {
  const TeamCardStatChip({
    super.key,
    required this.icon,
    required this.label,
    required this.foregroundColor,
    required this.backgroundColor,
  });

  final IconData icon;
  final String label;
  final Color foregroundColor;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: foregroundColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: foregroundColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
