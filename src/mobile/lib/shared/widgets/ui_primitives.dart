import 'package:flutter/material.dart';
import 'package:styled_widget/styled_widget.dart';

import '../../core/theme/app_theme.dart';

class UiCard extends StatelessWidget {
  const UiCard({super.key, required this.child, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return child
        .padding(all: 0)
        .decorated(
          color: AppThemeTokens.darkCard,
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(color: AppThemeTokens.darkBorder),
        )
        .padding(padding: padding);
  }
}

class UiPrimaryButton extends StatelessWidget {
  const UiPrimaryButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.loading = false,
    this.fullWidth = true,
  });

  final String text;
  final VoidCallback? onPressed;
  final bool loading;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton(
      onPressed: loading ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        backgroundColor: AppThemeTokens.primary500,
        disabledBackgroundColor: AppThemeTokens.primary700.withOpacity(0.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        ),
      ),
      child: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : Text(text),
    );
    return fullWidth ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class UiSectionTitle extends StatelessWidget {
  const UiSectionTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}
