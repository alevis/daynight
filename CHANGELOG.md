# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-03-25

- Initial release of DayNight Theme Scheduler.
- Added automatic theme switching based on up to four configured time ranges.
- Added support for both 12-hour and 24-hour time input.
- Added overnight range handling and overlap validation.
- Added a glassmorphism-style scheduler UI in a VS Code webview.
- Replaced checkbox controls with on/off toggle switches for each range.
- Added searchable theme inputs for faster theme selection.
- Added exact-match validation so searchable theme inputs only accept installed themes.
- Switched the scheduler UI to bundled offline fonts using Outfit and Google Sans Code.
- Added day/night default ranges based on sunrise and sunset lookup, with a 6:00 AM / 6:00 PM fallback.
- Added status bar access and startup/theme-boundary application logic.
- Added scheduler unit tests and local packaging documentation.
- Added marketplace metadata, launcher config, and screenshot documentation.
