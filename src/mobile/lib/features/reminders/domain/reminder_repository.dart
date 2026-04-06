import '../../../core/models/reminder_model.dart';

abstract class ReminderRepository {
  Future<List<ReminderModel>> getReminders();
  Future<ReminderModel> updateReminder(String reminderId, int minutesBefore);
  Future<void> deleteReminder(String reminderId);
}
