use agc_core::{audio::preview_audio, config::default_config, security::SecurityManager};
use std::{fs, path::PathBuf};

fn fixture() -> tempfile::TempDir {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../work/audio-tests");
    fs::create_dir_all(&root).unwrap();
    tempfile::tempdir_in(root).unwrap()
}

#[test]
fn selected_private_audio_requires_auth_and_supports_all_three_gundam_themes() {
    let data = fixture();
    let mut security = SecurityManager::new(data.path());
    let mut config = default_config();
    let id = "abcdef12-abcd-abcd-abcd-abcdef123456.wav";
    config.rg.startup_audio_id = id.into();
    assert!(preview_audio(data.path(), &config, &mut security).is_err());
    security.setup("fixture-audio-password").unwrap();
    fs::create_dir_all(data.path().join("assets")).unwrap();
    let wave = b"RIFF\x04\x00\x00\x00WAVE";
    fs::write(data.path().join("assets").join(id), wave).unwrap();
    config.selected_preset = "gundam".into();
    assert!(preview_audio(data.path(), &config, &mut security).unwrap().is_none());
    config.splash.audio_id = id.into();
    for selected in ["gundam", "focus", "paper"] {
        config.selected_preset = selected.into();
        let source = preview_audio(data.path(), &config, &mut security).unwrap().unwrap();
        assert_eq!(source.mime, "audio/wav");
        assert_eq!(source.bytes, wave);
    }
    config.selected_preset = "sao-aincrad".into();
    assert!(preview_audio(data.path(), &config, &mut security).unwrap().is_none());
    config.splash.theme_audio_ids.insert("sao".into(), id.into());
    assert!(preview_audio(data.path(), &config, &mut security).unwrap().is_some());
    security.lock();
    assert!(preview_audio(data.path(), &config, &mut security).is_err());
}

#[test]
fn audio_preview_rejects_traversal_text_and_oversize_assets() {
    let data = fixture();
    let mut security = SecurityManager::new(data.path());
    security.setup("fixture-audio-password").unwrap();
    let mut config = default_config();
    config.selected_preset = "gundam".into();
    fs::create_dir_all(data.path().join("assets")).unwrap();
    for id in ["../security.json", "security.json", "abcdef12-abcd-abcd-abcd-abcdef123456.html", "not-a-uuid.mp3"] {
        config.splash.audio_id = id.into();
        assert!(preview_audio(data.path(), &config, &mut security).is_err());
    }
    let id = "abcdef12-abcd-abcd-abcd-abcdef123456.mp3";
    let file = data.path().join("assets").join(id);
    config.splash.audio_id = id.into();
    fs::write(&file, "<html>not audio</html>").unwrap();
    assert!(preview_audio(data.path(), &config, &mut security).is_err());
    fs::OpenOptions::new().write(true).open(&file).unwrap().set_len(100 * 1024 * 1024 + 1).unwrap();
    assert!(preview_audio(data.path(), &config, &mut security).is_err());
}
