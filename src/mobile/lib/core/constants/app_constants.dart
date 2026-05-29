const List<Map<String, String>> kSportTypes = [
  {'value': '', 'label': 'None / Mixed'},
  {'value': 'football', 'label': 'Football'},
  {'value': 'basketball', 'label': 'Basketball'},
  {'value': 'tennis', 'label': 'Tennis'},
  {'value': 'volleyball', 'label': 'Volleyball'},
  {'value': 'running', 'label': 'Running'},
  {'value': 'cycling', 'label': 'Cycling'},
  {'value': 'swimming', 'label': 'Swimming'},
  {'value': 'cricket', 'label': 'Cricket'},
  {'value': 'americanFootball', 'label': 'American Football'},
  {'value': 'iceHockey', 'label': 'Ice Hockey'},
  {'value': 'baseball', 'label': 'Baseball'},
  {'value': 'rugby', 'label': 'Rugby'},
  {'value': 'handball', 'label': 'Handball'},
  {'value': 'fieldHockey', 'label': 'Field Hockey'},
  {'value': 'other', 'label': 'Other'},
];

String sportTypeLabel(String? value) {
  if (value == null || value.isEmpty) return 'None / Mixed';
  return kSportTypes.firstWhere(
    (s) => s['value'] == value,
    orElse: () => {'value': value, 'label': value},
  )['label']!;
}

const List<Map<String, String>> kEventTypes = [
  {'value': 'match', 'label': 'Match'},
  {'value': 'training', 'label': 'Training'},
  {'value': 'tournament', 'label': 'Tournament'},
  {'value': 'friendly', 'label': 'Friendly'},
  {'value': 'other', 'label': 'Other'},
];

const List<Map<String, String>> kTournamentFormats = [
  {'value': 'single_elimination', 'label': 'Single Elimination'},
  {'value': 'round_robin', 'label': 'Full Round Robin'},
  {'value': 'groups_knockout', 'label': 'Groups + Knockout'},
];
