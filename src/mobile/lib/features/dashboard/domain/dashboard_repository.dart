import '../../../core/models/dashboard_model.dart';

abstract class DashboardRepository {
  /// Fetches the aggregate dashboard payload from the server in a single request.
  Future<DashboardModel> getDashboard();
}
