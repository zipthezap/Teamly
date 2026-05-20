bool canRegisterTeam(String status, {required bool hasMyTeam, bool isOrganizer = false}) {
  return (status == 'registration' || status == 'draft') && !hasMyTeam && !isOrganizer;
}

bool canEditTournament(String status) {
  return status == 'draft' || status == 'registration' || status == 'registration_closed';
}

bool canManageTournamentAdminActions(String status) {
  return canEditTournament(status);
}
