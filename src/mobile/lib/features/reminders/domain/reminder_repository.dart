import '../../../core/models/reminder_model.dart';

abstract class ReminderRepository {
  Future<List<ReminderModel>> getReminders();
  Future<ReminderModel> updateReminder(String reminderId, DateTime remindAt);
  Future<void> deleteReminder(String reminderId);
}
