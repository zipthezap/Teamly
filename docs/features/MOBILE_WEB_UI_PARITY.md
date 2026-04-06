# Mobile/Web UI Parity Checklist

This checklist defines the shared visual baseline between web (Tailwind + MUI) and Flutter mobile.

## Shared design tokens

- Background: `#0f1419`
- Card surface: `#1a202c`
- Border: `#374151`
- Primary: `#2196f3`
- Primary dark: `#1976d2`
- Text primary: `#e5e7eb`
- Text secondary: `#9ca3af`
- Radius baseline: `8/12/16`
- Font family: `Inter`

## Utility-style implementation on Flutter

- Flutter uses `styled_widget` for utility-style composition.
- Reusable primitives:
  - `UiCard`
  - `UiPrimaryButton`
  - `UiSectionTitle`
- Global tokenized theme in `src/mobile/lib/core/theme/app_theme.dart`.

## Screen parity targets (initial pass)

- Auth page
  - gradient background
  - tokenized card/input/button spacing and radius
- Dashboard page
  - tokenized cards, text hierarchy, stat cards, event list cards
- Mobile shell
  - dark nav surface + border + badge consistency

## Accepted platform differences

- Navigation patterns remain platform-native (bottom navigation, route transitions).
- Safe area and touch target adjustments remain mobile-specific.
- Keyboard/accessibility behavior remains platform-specific.
