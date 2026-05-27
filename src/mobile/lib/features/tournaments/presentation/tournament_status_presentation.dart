import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import 'tournament_status_policy.dart';

class TournamentStatusPresentation {
  const TournamentStatusPresentation({
    required this.label,
    required this.icon,
    required this.color,
    required this.backgroundColor,
  });

  final String label;
  final IconData icon;
  final Color color;
  final Color backgroundColor;
}

TournamentStatusPresentation getTournamentStatusPresentation({
  required String status,
  bool isFormingKnockoutBrackets = false,
  DateTime? registrationStartDate,
  DateTime? registrationDeadline,
  DateTime? now,
}) {
  final label = getTournamentStageLabel(
    status: status,
    isFormingKnockoutBrackets: isFormingKnockoutBrackets,
    registrationStartDate: registrationStartDate,
    registrationDeadline: registrationDeadline,
    now: now,
  );

  switch (status) {
    case TournamentLifecycleStatus.registration:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.app_registration_outlined,
        color: AppThemeTokens.warning,
        backgroundColor: AppThemeTokens.warningBg,
      );
    case TournamentLifecycleStatus.registrationClosed:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.lock_clock_outlined,
        color: AppThemeTokens.error,
        backgroundColor: AppThemeTokens.errorBg,
      );
    case TournamentLifecycleStatus.inProgress:
    case TournamentLifecycleStatus.activeLegacy:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.play_circle_outline,
        color: AppThemeTokens.info,
        backgroundColor: AppThemeTokens.infoBg,
      );
    case TournamentLifecycleStatus.completed:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.check_circle_outline,
        color: AppThemeTokens.success,
        backgroundColor: AppThemeTokens.successBg,
      );
    case TournamentLifecycleStatus.cancelled:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.cancel_outlined,
        color: AppThemeTokens.error,
        backgroundColor: AppThemeTokens.errorBg,
      );
    default:
      return TournamentStatusPresentation(
        label: label,
        icon: Icons.edit_note_outlined,
        color: AppThemeTokens.primary500,
        backgroundColor: AppThemeTokens.primaryGlow,
      );
  }
}
