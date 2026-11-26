# Validation

## Password synchronization repair — 2026-11-25

- JavaScript syntax checks passed for 35 files; all 19 Node tests passed.
- Rust release tests passed: 4 unit tests and 4 integration tests. Integration
  tests invoke the actual Node credential authority against isolated profiles,
  covering Rust → Node and Node → Rust password changes, rejection of old
  passwords, compatibility with both pre-existing salt formats, corrupt-record
  rejection and cross-process setup locking.
- Shared-directory resolution follows an installed native manifest, including a
  non-default native data directory. Both implementations reject corrupt manifests.
  Explicit legacy-password repair backs up native credentials and preserves native
  config; normal startup does not overwrite the shared password from an old profile.
- An owned copy of the installed Antigravity App 2.35.1 executable and original
  ASAR passed install, same-version refresh, installed-helper password change,
  refusal to redirect an existing installation to another profile, and uninstall.
  The copy's executable was unchanged and its original ASAR restored byte-for-byte.
  This is installer/helper compatibility evidence, not a live Google App UI test.
- The password repair CLI correctly refused to run while the user's App was open.
  The Rust/Tauri release build succeeded and replaced `release/Antigravity Custom.exe`,
  with the previous executable retained under `work/`.
- After the user closed both applications, refreshed the actual installed 2.35.1
  community helper and imported the existing legacy Rust credential into its native
  profile. The previous credential was backed up in that profile, and the previous
  community helper was copied under `work/`. The installed helper matches source;
  the Rust CLI resolves exactly the same native directory and reports configured.
  The imported credential matches the legacy source record. Hash checks confirm the
  Google executable, installed ASAR and native config are all unchanged. No user
  process was terminated. Interactive login with the user's password was not automated.

## Version 0.4.2

- Added event cue playback, authenticated folder import in both manager and native Settings, whitelisted personal cue IDs, and event/track selection. Cue audio is not bundled in the EXE or exported presets.
- Syntax checks, 14 tests and standalone UI smoke passed. New tests cover interruption/stale callbacks, missing/rejected/timed-out audio, mute/teardown settlement, config privacy, validated all-or-nothing file selection and locked cue import.
- Native test on an owned Antigravity App 2.34.0 copy passed in `work/native-1795529315302`, importing the actual six MP3s into a test profile. It observed begin, authenticated, welcome, enter and shutdown playback, verification cue requests, wrong-password rejection without success cue, no legacy full track overlap, mute cancellation and delayed handoff for the enter cue. The Google executable hash remained unchanged and ASAR was restored byte-for-byte.
- No production profile or running user process was changed. Software playback was tested; physical speaker output is not measured.
- Final native rerun passed in `work/native-1795529528155`, including the Settings event selector and 6/6 imported-cue status. An intermediate test failed because it remained on the RG tab before clicking a hidden theme card; corrected the test to return to Themes and reran successfully.
- Windows portable 0.4.2 built; packaged smoke (`work/packaged-1795529604246`) and portable extraction/start (`work/portable-1795529605617`) passed. Automatic cleanup removed 0.4.1 artifacts and obsolete test copies, reclaiming a further 1.93 GiB. The cue/reference folders and native recovery backups were preserved.

## Version 0.4.1

- Added scan, particle and ring motion, short panel transitions and hidden-document pause; reduced motion disables decorative animation.
- The user's local configuration already selected Full, sound enabled, volume 80 and valid startup/end media. Their files decoded successfully. Previously the cinematic track waited for successful authentication. It now starts on Begin (or explicit Listen), continues across authentication and does not restart after password verification. The sound button initializes from the configured mute state. Playback/error status is visible.
- Native test on an owned App 2.34.0 copy passed in `work/native-1795528290991`: 18 particles, advancing scan animation, startup playback before authentication with progressing currentTime, expected 46.26-second duration, nonzero volume and unmuted output, mute/unmute toggles, wrong-password rejection, full-mode Skip, same-window handoff and shutdown. Executable hash stayed unchanged and ASAR was restored. This verifies software playback, not the user's Windows mixer/speaker output.
- Syntax checks, 10 tests and standalone UI smoke passed. No production profile was changed and no running user process was terminated.
- Removed old 0.1–0.3.1 artifacts and generated test copies, reclaiming 10.81 GiB initially. `postpackage:win` now tests packaged/portable builds, writes the current source ZIP and then cleans older versions. Current artifacts, most recent test runs, reference assets, imported audio and native recovery backups are retained. Running or reparse-point targets are skipped.
- The 0.4.1 EXE build, packaged smoke (`work/packaged-1795528492192`) and portable smoke (`work/portable-1795528493545`) passed. The first cleanup post-step failed because Windows PowerShell did not expose Get-FileHash; replaced it with .NET SHA256. Source archiving and cleanup then passed on rerun. Only 0.4.1 release artifacts remain; source, media, references and real native recovery backups are retained.

## Version 0.4.0

- Added the Plavsky illustration, native GP Base/form layout, verification/success/welcome/ready states, personal startup/end audio slots, full-track playback with Skip and bounded fallback, and an opt-in shutdown view.
- `npm run check`, 10 core/config tests, standalone UI smoke and integration fixture passed. The new config test checks personal audio IDs, invalid input, preset export privacy and import preservation.
- Native App copy test passed on Antigravity App 2.34.0 in `work/native-1795526285138`. It imported the actual 46.26-second startup v2 into a separate test profile, verified that Full did not finish early and that Skip reached readiness normally. Existing wrong-password, main-process authorization, same-window handoff, Settings and restore assertions passed.
- The test enabled shutdown through authenticated Settings, invoked `endSession`, observed the shutdown view and its bounded close. The initial Windows `CloseMainWindow` experiment did not surface this view, so the directly verified shutdown path is Settings → Custom → RG System → Kết thúc phiên Antigravity. Process termination and OS shutdown are not covered.
- The original Google executable stayed unchanged and the test copy's ASAR was restored byte-for-byte. No 0.4.0 install was applied to the user's active App.
- This is an implementation of the reviewed direction, not a pixel-identical rendering of every generated mockup. Real user configuration and names remain intact. Imported anime recordings are not bundled in builds or shared presets.
- Windows x64 portable 0.4.0 built successfully. Packaged smoke passed in `work/packaged-1795526330334`; the final portable extraction/start, fresh config, no bundled credentials, integration disabled by default and locked-launch rejection passed in `work/portable-1795526433703`.

## Version 0.3.1

- Removed the duplicate window button from the native splash. Window controls remain owned by Antigravity. Escape dismisses only the Settings preview.
- The native App test verified the splash header, preview dismissal, password gate, MP3 playback and Settings persistence. Installed 0.3.1 with the previous configuration file preserved byte for byte.

## Version 0.3.0

- Verified the native flow on a copy of Antigravity App 2.34.0. The supplied MP3 decoded at 296.976 seconds and played in loop mode before and after password verification. Clicking **Vào hệ thống** closed the startup view.
- Opened **Settings → Custom** in the App, selected a preset, and switched directly to General. The native pane returned and the selection persisted.
- Ran syntax checks, all 9 core tests, the standalone UI smoke test, the Settings fixture and the native App smoke test. The test copy restored the original ASAR hash.
- Installed 0.3.0 on the user's App. Verified the original backup and executable hashes and checked that the imported MP3 matches the source byte for byte.
- The optional English announcer uses Kokoro-82M with a speaker effect. Speech recognition verified both lines. Similarity to the reference is pending a listening comparison.

## Version 0.2.0

## Core and management interface

- JavaScript syntax checks passed.
- All 9 core tests passed: scrypt/unique salt, Unicode password, wrong password, rotation, restart, persistent rate limiting, setup race, corrupt credentials, preset privacy/validation, atomic config and executable restrictions.
- Electron management UI smoke passed: locked IPC, setup mismatch, theme selection/search/filter, create/delete, media import/custom protocol, preview without launch, authenticated mock launch, private preset import/export, lock and restart persistence.

## Native replacement on a real App copy

The test copied the installed Antigravity App 2.34.0 into an ignored work directory. Its own configuration/password and Electron window profile were separate. The App still uses shared agent project storage, so no conversations were selected and no prompts were sent.

Verified:

- The Google executable hash is unchanged.
- Only loadingOverlay payload bytes and that entry's integrity metadata changed; other archive payload bytes and header entries match.
- The custom startup is a WebContentsView inside the existing App window, not another launcher process/window.
- Dismissal before authentication is rejected by the main process.
- A wrong password keeps the native gate present even while the Hub loads behind it.
- The correct password, completed effect and ready Hub remove that view and focus the same App.
- No original logo-pulse splash is also created.
- Custom gallery opens full Settings in the same App as another local view.
- Preset selection persists. Returning to Antigravity closes Settings instead of spawning a process.
- Uninstall restores the stock ASAR hash byte-for-byte. The executable still matches its original hash.

The initial test caught a teardown error caused by reading a destroyed webContents ID; this was corrected by capturing IDs before destruction. Final native tests passed after that fix.

## Packaged manager

- Windows x64 portable build completed with Electron 45.4.1 / Electron Builder 26.18.0.
- The real packaged application passed setup, gallery, preview, locking and wrong-password checks. Development environment bypass is ignored by packaged builds.
- The portable EXE extracts and starts with fresh configuration, no bundled password/media and no enabled legacy integration.
- A packaged installer test installed its runtime from inside its own ASAR into a controlled App copy, then uninstalled and restored the original archive. This specifically covers Electron's original-fs handling of raw ASAR archives; ordinary fs is used only to read the manager's own virtual source files.

## Applied installation

Native mod 0.2.0 was installed into the user's Antigravity App 2.34.0 after the copy tests passed. The original ASAR is retained under resources/agc-custom-backup. The executable, shortcuts and Google profile files were not patched. The installed mod uses the pre-existing Custom configuration/password directory rather than replacing it.

Production native mode uses webContents.debugger internally. The management program does not open an external remote-debugging port when launching Antigravity.

## Limits

Source recovery (2026-11-26): see [SOURCE-RECOVERY.md](SOURCE-RECOVERY.md) for
provenance and limits. Recovered native/core/renderer/media come from the
checksum-verified v0.5.0 portable ZIP; Rust and packaging changes were reconstructed
from the recorded patches. The reconstructed release build passed, along with
44-file JavaScript syntax checking, 33 Node tests, 10 core Rust tests, one
release-mode launcher Rust test and the Edge UI fixture (including readiness
fallback and the 2.3-second Gundam entry cue). Live App 2.35.1 was returned to its
original ASAR hash on request; the Google executable was unchanged. This recovery
does not claim byte-identical Rust source or a newly tested authenticated App flow.

This validates the inspected Windows App version and the exercised startup/Settings routes. It does not guarantee future App compatibility, full replacement of Google's internal theme system or IDE editor wallpaper. The existing model-loading connectivity error is outside this project's scope. The gate protects startup UI, not agent services, disk data or a Windows account from its owner.
