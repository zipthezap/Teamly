class TournamentLifecycleStatus {
  static const String draft = 'draft';
  static const String registration = 'registration';
  static const String registrationClosed = 'registration_closed';
  static const String inProgress = 'in_progress';
  static const String completed = 'completed';
  static const String cancelled = 'cancelled';
  static const String activeLegacy = 'active';
}

bool isRegistrationOpenStatus(String status) {
  return status == TournamentLifecycleStatus.draft ||
      status == TournamentLifecycleStatus.registration;
}

bool canEditTournamentSetupStatus(String status) {
  return status == TournamentLifecycleStatus.draft ||
      status == TournamentLifecycleStatus.registration ||
      status == TournamentLifecycleStatus.registrationClosed;
}

bool canManageTournamentAdminActionsStatus(String status) {
  return canEditTournamentSetupStatus(status) ||
      status == TournamentLifecycleStatus.inProgress;
}

bool isTournamentStartedStatus(String status) {
  return status == TournamentLifecycleStatus.inProgress ||
      status == TournamentLifecycleStatus.completed;
}

String getTournamentStageLabel({
  required String status,
  bool isFormingKnockoutBrackets = false,
  DateTime? registrationStartDate,
  DateTime? registrationDeadline,
  DateTime? now,
}) {
  if (status == TournamentLifecycleStatus.completed) return 'Done';
  if (status == TournamentLifecycleStatus.inProgress ||
      status == TournamentLifecycleStatus.activeLegacy) {
    return isFormingKnockoutBrackets ? 'Forming Brackets' : 'In Progress';
  }
  if (status == TournamentLifecycleStatus.registrationClosed) {
    return 'Registration Closed';
  }
  if (status == TournamentLifecycleStatus.registration) {
    return 'Registration Open';
  }
  if (status == TournamentLifecycleStatus.cancelled) return 'Cancelled';

  final currentTime = now ?? DateTime.now();
  final hasRegDates =
      registrationStartDate != null || registrationDeadline != null;
  if (hasRegDates) {
    final hasOpened =
        registrationStartDate == null || !currentTime.isBefore(registrationStartDate);
    final isClosed =
        registrationDeadline != null && currentTime.isAfter(registrationDeadline);
    if (hasOpened && isClosed) return 'Registration Closed';
  }

  return 'Draft';
}
