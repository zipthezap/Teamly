abstract class NotificationPreferencesRepository {
  Future<Map<String, bool>> getPreferences();
  Future<void> updatePreferences(Map<String, bool> prefs);
}
