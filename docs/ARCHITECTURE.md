# Architecture 0.5 — shared launcher/native profile

## Shared credentials

The Rust/Tauri launcher resolves its data directory from the installed community
`resources/agc-custom/install.json`, exactly as the native overlay does. Without
an installation, Windows defaults to `%APPDATA%/antigravity-custom`. A malformed
manifest fails closed instead of silently creating another profile. The former
Rust directory under LocalAppData is no longer the active launcher profile.

Both authorities reload `security.json` for authentication and password changes.
New scrypt-v1 records use the stored hex salt as UTF-8, matching the original Node
format. Verification also accepts the raw-byte salt used by Rust v0.5.0, so old
passwords remain valid. Password writes replace the file atomically. Both runtimes
serialize credential mutations through `security.json.lock`, preventing a slow
verification from overwriting a concurrent password change. Locks do not share
unlocked sessions; each process must authenticate independently.

Legacy password repair is explicit: `scripts/sync-password.cjs` copies the selected
old Rust credential record into the installed shared directory, backing up the
previous native record there first. It refuses running Apps/launchers and an
unverified or outdated native installation. It never reads a plaintext password,
prints a credential record, or changes native config/media. Normal startup never
imports an old credential over the current shared password.

## Native startup

The installer checks the exact App 2.34.0 ASAR hash and reads Electron fuse state without changing the executable. It saves a byte-for-byte backup, patches only the loadingOverlay entry at its existing size/offset and installs community code under resources/agc-custom. Other archive payload bytes remain unchanged. Unknown App versions or updates are refused.

The original App calls attachLoadingOverlay while building its existing Hub window. The shim delegates that call to the native module, which adds a sandboxed local WebContentsView in that same window. IPC verifies the sender and frame URL. The overlay stays until credential verification, visual completion and Hub readiness are all satisfied. It does not create a second splash window or restart the App after the effect.

## In-App Settings

After unlock, the module uses an internal webContents.debugger session and a small Runtime binding for preset selection, opening Settings or removing the visual overlay. No external debugger port is opened. The companion gallery uses Shadow DOM and whitelisted data. Full Settings is another sandboxed WebContentsView in the same native window, with its own preload/IPC allowlist and the shared credential authority. Returning to Antigravity removes that view rather than spawning another process.

## Manager and distribution

The standalone manager is now Rust/Tauri; the native overlay and Settings remain
Electron code hosted by Antigravity. Actual launch never plays a separate splash
in the manager. Save, launch, install/uninstall and password changes require
authentication in Rust. The native Settings dispatcher retains its own main-process
authorization. Media import and preset sharing are implemented in native Settings;
their Tauri adapters are still placeholders.

The Google process may use shared agent storage even with isolated Electron userData. Test copies and live screenshots are therefore excluded from distribution. Only community-owned source and original assets ship; Google binaries, backups and test profiles never ship.

## Recovery

An App update may replace the shim. Uninstall refuses an ASAR that differs from the recorded patched hash and never downgrades a new App. Restore checks the saved hash, replaces the archive and removes only the owned helper directory after verifying absolute target boundaries.

The legacy CDP code remains as a fixture-tested prototype. The 0.2 production manager does not launch Antigravity with remote-debugging flags.
