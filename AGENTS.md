# Project instructions

- Target **Antigravity App**, not Antigravity IDE. Do not use VSIX as an App integration mechanism.
- The user explicitly requested native splash replacement after v0.1. Keep the project independent, but a version-checked, backed-up patch to app.asar is now authorized for that purpose. Do not modify the Google executable or Google profile files. Keep uninstall/restore support and refuse unknown App versions.
- Runtime integration is experimental, explicit opt-in, loopback-only and removable. Never terminate an existing user App process to enable it.
- Keep credentials in main process; enforce authentication on launch and all persistent mutations. Never export passwords, personal names, machine paths or credential records in presets.
- Preserve sandbox/contextIsolation, explicit IPC allowlists and restrictive renderer CSP.
- Keep scratch files, test profiles and screenshots in work/. Keep distribution artifacts in release/.
- Run npm run check and tests appropriate to the modified boundary. Record actual Google App compatibility separately from fixture tests.
