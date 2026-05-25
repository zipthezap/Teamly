import 'tournament_status_policy.dart';

/// Returns true when a participant (non-organizer, not yet registered) may
/// register a team.  Registration is only accepted while the lifecycle status
/// is explicitly open for registration.
bool canRegisterTeam(String status, {required bool hasMyTeam, bool isOrganizer = false}) {
  return isRegistrationOpenStatus(status) && !hasMyTeam && !isOrganizer;
}

/// Returns true when tournament settings may still be edited by an organizer.
/// Once a tournament is in progress, completed, or cancelled the core config
/// is locked; draft / registration / registration_closed are all still editable.
bool canEditTournament(String status) {
  return canEditTournamentSetupStatus(status);
}

/// Returns true when an organizer may manage administrative actions such as
/// pools, categories, match scheduling, and bracket generation.
/// In-progress tournaments also allow bracket regeneration, score entry, and
/// game-day operations, so we deliberately widen the permission here.
bool canManageTournamentAdminActions(String status) {
  return canManageTournamentAdminActionsStatus(status);
}
