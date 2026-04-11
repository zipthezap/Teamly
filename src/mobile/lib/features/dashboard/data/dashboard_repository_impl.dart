import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/dashboard_model.dart';
import '../../../core/network/api_client.dart';
import '../domain/dashboard_repository.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<DashboardModel> getDashboard() async {
    final response =
        await _dio.get<Map<String, dynamic>>('/auth/me/dashboard');
    return DashboardModel.fromJson(response.data!);
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepositoryImpl(ref.watch(dioProvider)),
);
