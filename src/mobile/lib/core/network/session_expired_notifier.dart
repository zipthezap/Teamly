import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Increments whenever the server rejects a token refresh (i.e. the session
/// has truly expired). The AuthNotifier watches this and forces a logout.
final sessionExpiredProvider = StateProvider<int>((ref) => 0);
