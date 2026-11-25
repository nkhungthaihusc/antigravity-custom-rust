# Architecture 0.2

## Native startup

The installer checks the exact App 2.34.0 ASAR hash and reads Electron fuse state without changing the executable. It saves a byte-for-byte backup, patches only the loadingOverlay entry at its existing size/offset and installs community code under resources/agc-custom. Other archive payload bytes remain unchanged. Unknown App versions or updates are refused.

The original App calls attachLoadingOverlay while building its existing Hub window. The shim delegates that call to the native module, which adds a sandboxed local WebContentsView in that same window. IPC verifies the sender and frame URL. The overlay stays until credential verification, visual completion and Hub readiness are all satisfied. It does not create a second splash window or restart the App after the effect.

## In-App Settings

After unlock, the module uses an internal webContents.debugger session and a small Runtime binding for preset selection, opening Settings or removing the visual overlay. No external debugger port is opened. The companion gallery uses Shadow DOM and whitelisted data. Full Settings is another sandboxed WebContentsView in the same native window, with its own preload/IPC allowlist and the shared credential authority. Returning to Antigravity removes that view rather than spawning another process.

## Manager and distribution

The standalone Electron executable is a configuration/install/uninstall tool. Actual launch never plays a separate splash in this tool. Privileged functions require main-process authentication. Native mode and the manager share normalized config, scrypt credentials and local asset IDs. User media comes from native file dialogs, is copied under generated IDs and is exposed through a constrained custom protocol.

The Google process may use shared agent storage even with isolated Electron userData. Test copies and live screenshots are therefore excluded from distribution. Only community-owned source and original assets ship; Google binaries, backups and test profiles never ship.

## Recovery

An App update may replace the shim. Uninstall refuses an ASAR that differs from the recorded patched hash and never downgrades a new App. Restore checks the saved hash, replaces the archive and removes only the owned helper directory after verifying absolute target boundaries.

The legacy CDP code remains as a fixture-tested prototype. The 0.2 production manager does not launch Antigravity with remote-debugging flags.
