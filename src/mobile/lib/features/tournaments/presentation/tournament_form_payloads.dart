String normalizeTournamentFormat(String format) {
  switch (format) {
    case 'bracket':
      return 'single_elimination';
    case 'pool':
      return 'round_robin';
    default:
      return format;
  }
}

Map<String, dynamic> buildCreateTournamentPayload({
  required String name,
  required String sportType,
  required String format,
  required DateTime? startDate,
  required DateTime? endDate,
  required DateTime? registrationStartDate,
  required DateTime? registrationDeadline,
  required String description,
  required String maxTeams,
  required String location,
  required String rulesDescription,
  required String prizesDescription,
  required bool useManualBrackets,
  required bool selfRefEnabled,
  required String registrationFee,
  required bool requirePaymentForBrackets,
  required String paymentInfo,
}) {
  return {
    'name': name.trim(),
    if (sportType.trim().isNotEmpty) 'sportType': sportType.trim(),
    'format': normalizeTournamentFormat(format),
    if (description.trim().isNotEmpty) 'description': description.trim(),
    if (maxTeams.trim().isNotEmpty) 'maxTeams': int.tryParse(maxTeams.trim()),
    if (startDate != null) 'startDate': startDate.toIso8601String(),
    if (endDate != null) 'endDate': endDate.toIso8601String(),
    if (registrationStartDate != null)
      'registrationStartDate': registrationStartDate.toIso8601String(),
    if (registrationDeadline != null)
      'registrationDeadline': registrationDeadline.toIso8601String(),
    if (location.trim().isNotEmpty) 'location': location.trim(),
    if (rulesDescription.trim().isNotEmpty)
      'rulesDescription': rulesDescription.trim(),
    if (prizesDescription.trim().isNotEmpty)
      'prizesDescription': prizesDescription.trim(),
    'useManualBrackets': useManualBrackets,
    'selfRefEnabled': selfRefEnabled,
    if (registrationFee.trim().isNotEmpty)
      'registrationFee': double.tryParse(registrationFee.trim()),
    'requirePaymentForBrackets': requirePaymentForBrackets,
    if (paymentInfo.trim().isNotEmpty) 'paymentInfo': paymentInfo.trim(),
  };
}

Map<String, dynamic> buildUpdateTournamentPayload({
  required String name,
  required String sportType,
  required String format,
  required DateTime? startDate,
  required DateTime? endDate,
  required DateTime? registrationStartDate,
  required DateTime? registrationDeadline,
  required String description,
  required String maxTeams,
  required String location,
  required String rulesDescription,
  required String prizesDescription,
  required bool useManualBrackets,
  required bool selfRefEnabled,
  required String registrationFee,
  required bool requirePaymentForBrackets,
  required String paymentInfo,
}) {
  return {
    'name': name.trim(),
    if (sportType.trim().isNotEmpty) 'sportType': sportType.trim(),
    'format': normalizeTournamentFormat(format),
    'description': description.trim().isNotEmpty ? description.trim() : null,
    if (maxTeams.trim().isNotEmpty) 'maxTeams': int.tryParse(maxTeams.trim()),
    if (startDate != null) 'startDate': startDate.toIso8601String(),
    if (endDate != null) 'endDate': endDate.toIso8601String(),
    if (registrationStartDate != null)
      'registrationStartDate': registrationStartDate.toIso8601String(),
    if (registrationDeadline != null)
      'registrationDeadline': registrationDeadline.toIso8601String(),
    'location': location.trim().isNotEmpty ? location.trim() : null,
    'rulesDescription':
        rulesDescription.trim().isNotEmpty ? rulesDescription.trim() : null,
    'prizesDescription':
        prizesDescription.trim().isNotEmpty ? prizesDescription.trim() : null,
    'useManualBrackets': useManualBrackets,
    'selfRefEnabled': selfRefEnabled,
    'registrationFee':
        registrationFee.trim().isNotEmpty ? double.tryParse(registrationFee.trim()) : null,
    'requirePaymentForBrackets': requirePaymentForBrackets,
    'paymentInfo': paymentInfo.trim().isNotEmpty ? paymentInfo.trim() : null,
  };
}
