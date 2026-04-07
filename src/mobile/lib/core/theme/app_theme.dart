import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class AppThemeTokens {
  static const Color darkBg = Color(0xFF0A0E17);
  static const Color darkCard = Color(0xFF141B27);
  static const Color darkCardElevated = Color(0xFF1C2535);
  static const Color darkCardHover = Color(0xFF243044);
  static const Color darkBorder = Color(0xFF2A3548);
  static const Color darkBorderSubtle = Color(0xFF1E2A3A);
  static const Color darkText = Color(0xFFECEFF4);
  static const Color darkTextSecondary = Color(0xFF8A99B3);
  static const Color darkTextMuted = Color(0xFF566070);

  static const Color primary500 = Color(0xFF2196F3);
  static const Color primary400 = Color(0xFF42A5F5);
  static const Color primary600 = Color(0xFF1E88E5);
  static const Color primary700 = Color(0xFF1976D2);
  static const Color primaryGlow = Color(0x332196F3);

  // Semantic status colors (mirrors frontend StatusBadge palette)
  static const Color success = Color(0xFF4ADE80);
  static const Color successBg = Color(0xFF0D2E1A);
  static const Color warning = Color(0xFFFBBF24);
  static const Color warningBg = Color(0xFF2D1F05);
  static const Color error = Color(0xFFF87171);
  static const Color errorBg = Color(0xFF2D0A0A);
  static const Color info = Color(0xFF60A5FA);
  static const Color infoBg = Color(0xFF0A1929);

  static const double radiusXs = 6;
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 20;
  static const double radiusXl = 28;

  // Gradient definitions
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2196F3), Color(0xFF0D47A1)],
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1A2744), Color(0xFF0D1B2E)],
  );

  static const LinearGradient subtleGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF141B27), Color(0xFF0F1520)],
  );
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    primary: AppThemeTokens.primary500,
    onPrimary: Colors.white,
    secondary: Color(0xFF7C4DFF),
    onSecondary: Colors.white,
    tertiary: Color(0xFF00BCD4),
    surface: AppThemeTokens.darkCard,
    onSurface: AppThemeTokens.darkText,
    error: Color(0xFFEF4444),
    onError: Colors.white,
    outline: AppThemeTokens.darkBorder,
    surfaceContainerHighest: AppThemeTokens.darkCardHover,
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
      bodySmall: base.textTheme.bodySmall?.copyWith(
        color: AppThemeTokens.darkTextSecondary,
        fontSize: 12,
        letterSpacing: 0.1,
      ),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(
        color: AppThemeTokens.darkText,
        fontSize: 14,
      ),
      bodyLarge: base.textTheme.bodyLarge?.copyWith(
        color: AppThemeTokens.darkText,
        fontSize: 16,
      ),
      labelSmall: base.textTheme.labelSmall?.copyWith(
        color: AppThemeTokens.darkTextSecondary,
        letterSpacing: 0.8,
        fontWeight: FontWeight.w600,
      ),
      titleSmall: base.textTheme.titleSmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppThemeTokens.darkText,
        fontSize: 14,
      ),
      titleMedium: base.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppThemeTokens.darkText,
        fontSize: 16,
      ),
      titleLarge: base.textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppThemeTokens.darkText,
        fontSize: 20,
        letterSpacing: -0.3,
      ),
      headlineMedium: base.textTheme.headlineMedium?.copyWith(
        fontWeight: FontWeight.w800,
        color: AppThemeTokens.darkText,
        letterSpacing: -0.5,
      ),
      headlineLarge: base.textTheme.headlineLarge?.copyWith(
        fontWeight: FontWeight.w800,
        color: AppThemeTokens.darkText,
        letterSpacing: -0.8,
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppThemeTokens.darkBg,
      foregroundColor: AppThemeTokens.darkText,
      elevation: 0,
      centerTitle: false,
      scrolledUnderElevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      titleTextStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppThemeTokens.darkText,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: CardThemeData(
      color: AppThemeTokens.darkCard,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        side: const BorderSide(color: AppThemeTokens.darkBorder, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppThemeTokens.darkCardElevated,
      labelStyle: const TextStyle(color: AppThemeTokens.darkTextSecondary, fontSize: 14),
      hintStyle: const TextStyle(color: AppThemeTokens.darkTextMuted, fontSize: 14),
      prefixIconColor: AppThemeTokens.darkTextSecondary,
      suffixIconColor: AppThemeTokens.darkTextSecondary,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
        borderSide: const BorderSide(color: AppThemeTokens.primary500, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppThemeTokens.darkCard,
      indicatorColor: AppThemeTokens.primaryGlow,
      height: 64,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? AppThemeTokens.primary400 : AppThemeTokens.darkTextSecondary,
          size: 22,
        );
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          color: selected ? AppThemeTokens.primary400 : AppThemeTokens.darkTextSecondary,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
        );
      }),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppThemeTokens.darkCardHover,
      side: const BorderSide(color: AppThemeTokens.darkBorder),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
      ),
      labelStyle: const TextStyle(
        color: AppThemeTokens.darkText,
        fontSize: 12,
        fontWeight: FontWeight.w500,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    ),
    dividerColor: AppThemeTokens.darkBorder,
    dividerTheme: const DividerThemeData(
      color: AppThemeTokens.darkBorder,
      thickness: 1,
      space: 1,
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      minLeadingWidth: 0,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return AppThemeTokens.primary400;
        return AppThemeTokens.darkTextSecondary;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return AppThemeTokens.primaryGlow;
        return AppThemeTokens.darkCardHover;
      }),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: AppThemeTokens.primary500,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppThemeTokens.primary500,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        ),
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppThemeTokens.primary400,
        side: const BorderSide(color: AppThemeTokens.darkBorder),
        minimumSize: const Size(0, 44),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppThemeTokens.primary400,
        textStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppThemeTokens.darkCardElevated,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
        side: const BorderSide(color: AppThemeTokens.darkBorder),
      ),
      titleTextStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppThemeTokens.darkText,
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppThemeTokens.darkCardElevated,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppThemeTokens.radiusXl),
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppThemeTokens.darkCardHover,
      contentTextStyle: const TextStyle(
        fontFamily: 'Inter',
        color: AppThemeTokens.darkText,
        fontSize: 14,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
      ),
      behavior: SnackBarBehavior.floating,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppThemeTokens.primary500,
    ),
  );
}
