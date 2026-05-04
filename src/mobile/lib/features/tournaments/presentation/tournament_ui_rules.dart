bool canRegisterTeam(String status, {required bool hasMyTeam, bool isOrganizer = false}) {
  return (status == 'registration' || status == 'draft') && !hasMyTeam && !isOrganizer;
}

bool canEditTournament(String status) {
  return status != 'completed' && status != 'cancelled';
}

bool canManageTournamentAdminActions(String status) {
  return canEditTournament(status);
}
