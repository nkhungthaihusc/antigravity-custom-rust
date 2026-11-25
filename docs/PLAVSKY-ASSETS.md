# Plavsky assets and behavior

Version 0.4.2 adds an optional event mode. Import the unzipped `Gundam-Startup-Cues` directory in authenticated Custom Settings. The importer accepts six fixed MP3 names, validates all files before copying, generates local asset IDs and switches to event mode. It does not accept path names from a manifest and never exports personal cue IDs in presets.

Events map to GP Base on Begin, preparation while awaiting password verification, Plavsky after successful authentication, scan on welcome, battle-start on Enter, and end on shutdown. A new event interrupts the previous cue. Wrong passwords stop the waiting cue without playing success. Mute, Skip and teardown settle outstanding playback promises. Missing, rejected or stalled media resolves without authorizing the session; each cue has a 15-second cap. The existing full-track option remains available. The reference-only Gunpla placement and long activation clips are not assigned automatically.

`src/renderer/plavsky-hangar.png` is an AI-generated anime-style illustration created with the built-in imagegen tool for this project. It contains no interface text. Native controls, authentication forms, state messages and buttons are real DOM elements. The reference is the user-reviewed Plavsky mockup. The illustration is a depiction inspired by Gundam Build Fighters, not an official Sunrise asset.

Generation prompt: preserve the central anime Star Build Strike and cyan Plavsky wings on a scanning platform in a dark hangar; remove all interface panels, text, banners, buttons and borders; keep the sides and lower floor dark for readable controls.

The native flow keeps consent, password verification, pending result, successful authentication, welcome, ready-to-enter and shutdown states. Only the main process can authorize entry, and Hub readiness remains required. The brief success/welcome states do not impose extra artificial authentication delays.

In **RG System**, choose Quick or Full and import startup/end audio separately. In 0.4.1 Full starts on Begin, before password entry, and continues across authentication without restarting. The Listen button can preview the selected track, including in Quick mode. Full uses actual playback completion; Skip cancels it. Missing or failed audio falls back to the visual timer. A two-minute upper limit prevents stalled media from hanging startup. Sound toggle state starts from the sound setting and controls the track plus session background music while this view exists. Personal media IDs are excluded from preset export.

Decorative particles and a scanning line are DOM/CSS animation, separate from the painted illustration. They cannot authenticate a session or make Hub readiness true. The layer is removed on teardown and pauses while the page is hidden. Reduced Motion disables it.

The selected personal startup source is the edited v2, 46.26 seconds, with the terrain announcement and Sei Iori declaration removed. The selected end source is four seconds. These recordings remain personal imported media and are not shipped inside the application.

Shutdown animation is opt-in. After an authenticated session, closing its window can show a darkened ending view for up to four seconds. **Settings → Custom → RG System → Kết thúc phiên Antigravity** provides a directly tested close path. This does not intercept termination of the process or an operating-system shutdown, and does not claim that user data was saved or synchronized.
