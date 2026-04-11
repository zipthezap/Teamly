// Conditional import: resolves to the real implementation on mobile and to the
// no-op stub on web (where flutter_app_badger is not available).
export 'badge_service_stub.dart'
    if (dart.library.io) 'badge_service_mobile.dart';
