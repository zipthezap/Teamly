import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/features/tournaments/presentation/tournament_status_policy.dart';

void main() {
  group('Tournament status policy', () {
    test('registration is open only for draft/registration', () {
      expect(isRegistrationOpenStatus(TournamentLifecycleStatus.draft), isTrue);
      expect(isRegistrationOpenStatus(TournamentLifecycleStatus.registration), isTrue);
      expect(isRegistrationOpenStatus(TournamentLifecycleStatus.registrationClosed), isFalse);
      expect(isRegistrationOpenStatus(TournamentLifecycleStatus.inProgress), isFalse);
    });

    test('stage labels map lifecycle statuses consistently', () {
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.completed), 'Done');
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.inProgress), 'In Progress');
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.registrationClosed), 'Registration Closed');
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.registration), 'Registration Open');
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.cancelled), 'Cancelled');
      expect(getTournamentStageLabel(status: TournamentLifecycleStatus.draft), 'Draft');
    });

    test('in-progress label supports forming-brackets override', () {
      expect(
        getTournamentStageLabel(
          status: TournamentLifecycleStatus.inProgress,
          isFormingKnockoutBrackets: true,
        ),
        'Forming Brackets',
      );
    });
  });
}
