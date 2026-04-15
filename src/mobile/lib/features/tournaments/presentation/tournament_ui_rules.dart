bool canRegisterTeam(String status, {required bool hasMyTeam}) {
  return status == 'registration' && !hasMyTeam;
}

bool canEditTournament(String status) {
  return status != 'completed' && status != 'cancelled';
}

bool canManageTournamentAdminActions(String status) {
  return canEditTournament(status);
}
