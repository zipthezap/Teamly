import 'package:flutter/material.dart';

class AppThemeTokens {
  static const Color darkBg = Color(0xFF0F1419);
  static const Color darkCard = Color(0xFF1A202C);
  static const Color darkCardHover = Color(0xFF2D3748);
  static const Color darkBorder = Color(0xFF374151);
  static const Color darkText = Color(0xFFE5E7EB);
  static const Color darkTextSecondary = Color(0xFF9CA3AF);

  static const Color primary500 = Color(0xFF2196F3);
  static const Color primary700 = Color(0xFF1976D2);

  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    primary: AppThemeTokens.primary500,
    onPrimary: Colors.white,
    secondary: Color(0xFFF50057),
    onSecondary: Colors.white,
    surface: AppThemeTokens.darkCard,
    onSurface: AppThemeTokens.darkText,
    error: Color(0xFFEF4444),
    onError: Colors.white,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppThemeTokens.darkBg,
    fontFamily: 'Inter',
  );

  return base.copyWith(
    textTheme: base.textTheme.apply(
      bodyColor: AppThemeTokens.darkText,
      displayColor: AppThemeTokens.darkText,
    ).copyWith(
      bodySmall: base.textTheme.bodySmall?.copyWith(color: AppThemeTokens.darkTextSecondary),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(color: AppThemeTokens.darkText),
      titleMedium: base.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      headlineMedium: base.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppThemeTokens.darkBg,
      foregroundColor: AppThemeTokens.darkText,
      elevation: 0,
      centerTitle: false,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      color: AppThemeTokens.darkCard,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        side: const BorderSide(color: AppThemeTokens.darkBorder, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppThemeTokens.darkCard,
      labelStyle: const TextStyle(color: AppThemeTokens.darkTextSecondary),
      prefixIconColor: AppThemeTokens.darkTextSecondary,
      suffixIconColor: AppThemeTokens.darkTextSecondary,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: AppThemeTokens.darkBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: AppThemeTokens.darkBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: AppThemeTokens.primary500, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppThemeTokens.darkCard,
      indicatorColor: AppThemeTokens.darkCardHover,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? AppThemeTokens.primary500 : AppThemeTokens.darkTextSecondary,
        );
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          color: selected ? AppThemeTokens.darkText : AppThemeTokens.darkTextSecondary,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
        );
      }),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppThemeTokens.darkCardHover,
      side: const BorderSide(color: AppThemeTokens.darkBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
      ),
      labelStyle: const TextStyle(color: AppThemeTokens.darkText),
    ),
    dividerColor: AppThemeTokens.darkBorder,
  );
}
