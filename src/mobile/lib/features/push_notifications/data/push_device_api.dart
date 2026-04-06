import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class PushDeviceApi {
  PushDeviceApi(this._dio);

  final Dio _dio;

  Future<void> registerDevice({
    required String token,
    required String platform,
    String? locale,
    String? timezone,
    String? appVersion,
    String? deviceModel,
  }) async {
    await _dio.post<void>(
      '/push-devices',
      data: {
        'token': token,
        'platform': platform,
        if (locale != null) 'locale': locale,
        if (timezone != null) 'timezone': timezone,
        if (appVersion != null) 'appVersion': appVersion,
        if (deviceModel != null) 'deviceModel': deviceModel,
      },
    );
  }

  Future<void> refreshDevice({
    required String oldToken,
    required String newToken,
    required String platform,
    String? locale,
    String? timezone,
    String? appVersion,
    String? deviceModel,
  }) async {
    await _dio.put<void>(
      '/push-devices/refresh',
      data: {
        'oldToken': oldToken,
        'newToken': newToken,
        'platform': platform,
        if (locale != null) 'locale': locale,
        if (timezone != null) 'timezone': timezone,
        if (appVersion != null) 'appVersion': appVersion,
        if (deviceModel != null) 'deviceModel': deviceModel,
      },
    );
  }

  Future<void> disableDevice(String token) async {
    await _dio.delete<void>(
      '/push-devices',
      data: {'token': token},
    );
  }
}

final pushDeviceApiProvider = Provider<PushDeviceApi>((ref) {
  return PushDeviceApi(ref.watch(dioProvider));
});
