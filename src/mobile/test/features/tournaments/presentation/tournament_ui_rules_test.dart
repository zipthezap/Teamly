import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/features/tournaments/presentation/tournament_ui_rules.dart';

void main() {
  group('Tournament UI rules', () {
    test('register button is shown during registration and draft, hidden when already registered', () {
      expect(canRegisterTeam('registration', hasMyTeam: false), isTrue);
      expect(canRegisterTeam('registration', hasMyTeam: true), isFalse);
      expect(canRegisterTeam('draft', hasMyTeam: false), isTrue);
      expect(canRegisterTeam('draft', hasMyTeam: true), isFalse);
      expect(canRegisterTeam('in_progress', hasMyTeam: false), isFalse);
    });

    test('register button is hidden for tournament organizer', () {
      expect(canRegisterTeam('registration', hasMyTeam: false, isOrganizer: true), isFalse);
      expect(canRegisterTeam('draft', hasMyTeam: false, isOrganizer: true), isFalse);
      expect(canRegisterTeam('registration', hasMyTeam: false, isOrganizer: false), isTrue);
    });

    test('edit/admin actions are only enabled before the tournament starts', () {
      expect(canEditTournament('draft'), isTrue);
      expect(canEditTournament('registration'), isTrue);
      expect(canEditTournament('in_progress'), isFalse);
      expect(canEditTournament('completed'), isFalse);
      expect(canEditTournament('cancelled'), isFalse);

      expect(canManageTournamentAdminActions('in_progress'), isFalse);
      expect(canManageTournamentAdminActions('completed'), isFalse);
      expect(canManageTournamentAdminActions('cancelled'), isFalse);
      expect(canManageTournamentAdminActions('registration'), isTrue);
    });
  });
}
