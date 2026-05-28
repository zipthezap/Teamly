import '../../../core/models/tournament_model.dart';

bool isGroupStageMatch(TournamentMatchModel match) {
  return match.stage == 'group_stage' ||
      (match.stage == null && match.groupName != null);
}

bool isKnockoutStageMatch(TournamentMatchModel match) {
  return match.stage != null && match.stage != 'group_stage';
}

bool isFormingKnockoutBrackets(TournamentModel tournament) {
  if (tournament.format != 'groups_knockout') return false;
  final groupMatches = tournament.matches.where(isGroupStageMatch).toList();
  if (groupMatches.isEmpty) return false;
  final hasKnockout = tournament.matches.any(isKnockoutStageMatch);
  final allGroupsDone = groupMatches.every((m) => m.status == 'completed');
  return allGroupsDone && !hasKnockout;
}
