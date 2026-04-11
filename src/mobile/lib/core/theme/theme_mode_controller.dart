import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kThemeModeKey = 'theme_mode';

final themeModeProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) => ThemeModeController(),
);

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController() : super(ThemeMode.light) {
    _init();
  }

  SharedPreferences? _prefs;

  Future<void> _init() async {
    _prefs = await SharedPreferences.getInstance();
    final stored = _prefs!.getString(_kThemeModeKey);
    if (stored == 'dark') {
      state = ThemeMode.dark;
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_kThemeModeKey, mode == ThemeMode.dark ? 'dark' : 'light');
  }
}
