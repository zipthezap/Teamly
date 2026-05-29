import 'package:flutter_test/flutter_test.dart';
import 'package:teamly_mobile/features/tournaments/presentation/tournament_form_payloads.dart';

void main() {
  group('Tournament form payloads', () {
    test('create payload always includes selfRefEnabled and keeps valid fields', () {
      final payload = buildCreateTournamentPayload(
        name: 'Spring Cup',
        sportType: 'soccer',
        format: 'single_elimination',
        startDate: DateTime(2026, 6, 1),
        endDate: DateTime(2026, 6, 3),
        registrationStartDate: DateTime(2026, 5, 1),
        registrationDeadline: DateTime(2026, 5, 25),
        description: 'Community event',
        maxTeams: '16',
        location: 'Main Field',
        rulesDescription: 'FIFA rules',
        prizesDescription: 'Trophy',
        useManualBrackets: true,
        selfRefEnabled: true,
        registrationFee: '20',
        requirePaymentForBrackets: true,
        paymentInfo: 'E-transfer',
      );

      expect(payload['selfRefEnabled'], isTrue);
      expect(payload['useManualBrackets'], isTrue);
      expect(payload['name'], 'Spring Cup');
      expect(payload['maxTeams'], 16);
      expect(payload['registrationFee'], 20.0);
      expect(payload['paymentInfo'], 'E-transfer');
    });

    test('update payload includes selfRefEnabled and clears empty optional fields', () {
      final payload = buildUpdateTournamentPayload(
        name: 'Spring Cup Updated',
        sportType: 'soccer',
        format: 'single_elimination',
        startDate: DateTime(2026, 6, 1),
        endDate: null,
        registrationStartDate: null,
        registrationDeadline: null,
        description: '',
        maxTeams: '',
        location: '',
        rulesDescription: '',
        prizesDescription: '',
        useManualBrackets: false,
        selfRefEnabled: false,
        registrationFee: '',
        requirePaymentForBrackets: false,
        paymentInfo: '',
      );

      expect(payload['selfRefEnabled'], isFalse);
      expect(payload['description'], isNull);
      expect(payload['location'], isNull);
      expect(payload['rulesDescription'], isNull);
      expect(payload['prizesDescription'], isNull);
      expect(payload['registrationFee'], isNull);
      expect(payload['paymentInfo'], isNull);
      expect(payload.containsKey('maxTeams'), isFalse);
    });

    test('legacy format aliases are normalized for API compatibility', () {
      final createPayload = buildCreateTournamentPayload(
        name: 'Legacy Create',
        sportType: 'soccer',
        format: 'bracket',
        startDate: DateTime(2026, 7, 1),
        endDate: null,
        registrationStartDate: null,
        registrationDeadline: null,
        description: '',
        maxTeams: '',
        location: '',
        rulesDescription: '',
        prizesDescription: '',
        useManualBrackets: false,
        selfRefEnabled: false,
        registrationFee: '',
        requirePaymentForBrackets: false,
        paymentInfo: '',
      );

      final updatePayload = buildUpdateTournamentPayload(
        name: 'Legacy Update',
        sportType: 'soccer',
        format: 'pool',
        startDate: DateTime(2026, 7, 1),
        endDate: null,
        registrationStartDate: null,
        registrationDeadline: null,
        description: '',
        maxTeams: '',
        location: '',
        rulesDescription: '',
        prizesDescription: '',
        useManualBrackets: false,
        selfRefEnabled: false,
        registrationFee: '',
        requirePaymentForBrackets: false,
        paymentInfo: '',
      );

      expect(createPayload['format'], 'single_elimination');
      expect(updatePayload['format'], 'round_robin');
    });
  });
}
