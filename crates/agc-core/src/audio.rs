use crate::config::AppConfig;
use crate::security::SecurityManager;
use serde::Serialize;
use std::{fs, path::Path};

#[derive(Serialize)]
pub struct PreviewAudio {
    pub mime: &'static str,
    pub bytes: Vec<u8>,
}

/// Return only the selected theme's local audio, after authentication.
/// The renderer cannot request arbitrary paths or credential records.
pub fn preview_audio(data_dir: &Path, config: &AppConfig, security: &mut SecurityManager) -> Result<Option<PreviewAudio>, String> {
    security.require()?;
    let family = config.presets.iter().find(|p| p.id == config.selected_preset).map(|p| p.family.as_str()).unwrap_or("focus");
    let id = config.splash.theme_audio_ids.get(family).filter(|id| !id.is_empty()).map(String::as_str)
        .or_else(|| if family != "sao" && !config.splash.audio_id.is_empty() { Some(config.splash.audio_id.as_str()) } else { None });
    let Some(id) = id else { return Ok(None); };
    let (uuid, extension) = id.rsplit_once('.').ok_or("Tài nguyên âm thanh không hợp lệ.")?;
    let valid_uuid = uuid.len() == 36 && uuid.bytes().enumerate().all(|(i, b)| {
        if [8, 13, 18, 23].contains(&i) { b == b'-' } else { b.is_ascii_hexdigit() }
    });
    let mime = match extension {
        "mp3" => "audio/mpeg", "wav" => "audio/wav", "ogg" => "audio/ogg", "m4a" => "audio/mp4",
        _ => return Err("Định dạng âm thanh không được hỗ trợ.".into()),
    };
    if !valid_uuid { return Err("ID tài nguyên âm thanh không hợp lệ.".into()); }
    let root = fs::canonicalize(data_dir.join("assets")).map_err(|e| e.to_string())?;
    let file = fs::canonicalize(root.join(id)).map_err(|e| e.to_string())?;
    if file.parent() != Some(root.as_path()) { return Err("Tài nguyên nằm ngoài kho media.".into()); }
    let metadata = fs::metadata(&file).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > 100 * 1024 * 1024 {
        return Err("File âm thanh trống hoặc vượt quá 100 MB.".into());
    }
    let bytes = fs::read(file).map_err(|e| e.to_string())?;
    let valid = match extension {
        "mp3" => bytes.starts_with(b"ID3") || (bytes.len() > 1 && bytes[0] == 255 && bytes[1] & 224 == 224),
        "wav" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WAVE"),
        "ogg" => bytes.starts_with(b"OggS"),
        "m4a" => bytes.get(4..8) == Some(b"ftyp"),
        _ => false,
    };
    if !valid { return Err("File không chứa âm thanh đúng định dạng.".into()); }
    Ok(Some(PreviewAudio { mime, bytes }))
}
