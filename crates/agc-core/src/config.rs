use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub family: String,
    pub mode: String,
    pub accent: String,
    pub background: String,
    pub foreground: String,
    pub motion: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplashConfig {
    pub enabled: bool,
    #[serde(rename = "durationMs")]
    pub duration_ms: u32,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "mediaId")]
    pub media_id: String,
    pub volume: u32,
    #[serde(rename = "audioId")]
    pub audio_id: String,
    #[serde(rename = "soundEnabled")]
    pub sound_enabled: bool,
    pub chime: bool,
    #[serde(rename = "musicScope", default = "default_music_scope")]
    pub music_scope: String,
}

fn default_music_scope() -> String {
    "startup".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WallpaperConfig {
    pub enabled: bool,
    #[serde(rename = "mediaId")]
    pub media_id: String,
    pub opacity: u32,
    pub blur: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherConfig {
    pub executable: String,
    #[serde(rename = "minimizeAfterLaunch")]
    pub minimize_after_launch: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityConfig {
    #[serde(rename = "reducedMotion")]
    pub reduced_motion: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RgConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_cyan")]
    pub color: String,
    #[serde(rename = "operatorName", default)]
    pub operator_name: String,
    #[serde(rename = "unitName", default = "default_unit")]
    pub unit_name: String,
    #[serde(rename = "modelName", default = "default_model")]
    pub model_name: String,
    #[serde(rename = "operatorClass", default = "default_class")]
    pub operator_class: String,
    #[serde(rename = "systemName", default = "default_system")]
    pub system_name: String,
    #[serde(rename = "readyText", default = "default_ready")]
    pub ready_text: String,
    #[serde(rename = "audioMode", default = "default_audio_mode")]
    pub audio_mode: String,
    #[serde(rename = "cinematicMode", default = "default_cinematic_mode")]
    pub cinematic_mode: String,
    #[serde(rename = "startupAudioId", default)]
    pub startup_audio_id: String,
    #[serde(rename = "endAudioId", default)]
    pub end_audio_id: String,
    #[serde(rename = "shutdownEnabled", default)]
    pub shutdown_enabled: bool,
    #[serde(rename = "cueAudioIds", default)]
    pub cue_audio_ids: std::collections::HashMap<String, String>,
}

fn default_true() -> bool { true }
fn default_cyan() -> String { "#22d3ee".into() }
fn default_unit() -> String { "WHITE GUNDAM".into() }
fn default_model() -> String { "RG-01".into() }
fn default_class() -> String { "OPERATOR".into() }
fn default_system() -> String { "NEURAL SYSTEM".into() }
fn default_ready() -> String { "SYSTEM READY".into() }
fn default_audio_mode() -> String { "track".into() }
fn default_cinematic_mode() -> String { "quick".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub enabled: bool,
    pub style: String,
    pub volume: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    #[serde(rename = "selectedPreset")]
    pub selected_preset: String,
    pub presets: Vec<Preset>,
    pub splash: SplashConfig,
    pub wallpaper: WallpaperConfig,
    pub launcher: LauncherConfig,
    pub integration: IntegrationConfig,
    pub accessibility: AccessibilityConfig,
    pub rg: RgConfig,
    pub voice: VoiceConfig,
}

pub fn default_builtins() -> Vec<Preset> {
    vec![
        Preset {
            id: "sao".into(),
            name: "White Gundam · Neural Cyan".into(),
            description: "Giao diện Mecha White Gundam với ánh sáng Plavsky Particle và viền kính Cyan.".into(),
            family: "gundam".into(),
            mode: "dark".into(),
            accent: "#22d3ee".into(),
            background: "#090e15".into(),
            foreground: "#e2f4f8".into(),
            motion: true,
        },
        Preset {
            id: "gundam".into(),
            name: "White Gundam · Strike Sky".into(),
            description: "Biến thể Mecha bầu trời với ánh xanh lam Strike và hạt năng lượng cao.".into(),
            family: "gundam".into(),
            mode: "dark".into(),
            accent: "#38bdf8".into(),
            background: "#09111c".into(),
            foreground: "#e0f2fe".into(),
            motion: true,
        },
        Preset {
            id: "focus".into(),
            name: "White Gundam · Stealth Dark".into(),
            description: "Tông đen xám cơ khí tối giản, giảm ánh sáng để tập trung lập trình.".into(),
            family: "focus".into(),
            mode: "dark".into(),
            accent: "#94a3b8".into(),
            background: "#0f172a".into(),
            foreground: "#f8fafc".into(),
            motion: false,
        },
        Preset {
            id: "paper".into(),
            name: "White Gundam · Pure Light".into(),
            description: "Biến thể giáp trắng tinh khiết, tương phản sáng cao.".into(),
            family: "focus".into(),
            mode: "light".into(),
            accent: "#0284c7".into(),
            background: "#f8fafc".into(),
            foreground: "#0f172a".into(),
            motion: false,
        },
    ]
}

pub fn default_config() -> AppConfig {
    AppConfig {
        schema_version: 1,
        selected_preset: "sao".into(),
        presets: default_builtins(),
        splash: SplashConfig {
            enabled: true,
            duration_ms: 3200,
            display_name: "Thái Nguyễn".into(),
            media_id: "".into(),
            volume: 25,
            audio_id: "".into(),
            sound_enabled: false,
            chime: true,
            music_scope: "startup".into(),
        },
        wallpaper: WallpaperConfig {
            enabled: true,
            media_id: "".into(),
            opacity: 20,
            blur: 0,
        },
        launcher: LauncherConfig {
            executable: "".into(),
            minimize_after_launch: true,
        },
        integration: IntegrationConfig { enabled: false },
        accessibility: AccessibilityConfig { reduced_motion: false },
        rg: RgConfig {
            enabled: true,
            color: "#22d3ee".into(),
            operator_name: "Thái Nguyễn".into(),
            unit_name: "WHITE GUNDAM".into(),
            model_name: "RG-01".into(),
            operator_class: "OPERATOR".into(),
            system_name: "NEURAL SYSTEM".into(),
            ready_text: "SYSTEM READY".into(),
            audio_mode: "track".into(),
            cinematic_mode: "quick".into(),
            startup_audio_id: "".into(),
            end_audio_id: "".into(),
            shutdown_enabled: false,
            cue_audio_ids: std::collections::HashMap::new(),
        },
        voice: VoiceConfig {
            enabled: false,
            style: "system".into(),
            volume: 45,
        },
    }
}

pub struct ConfigStore {
    file_path: PathBuf,
}

impl ConfigStore {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            file_path: data_dir.join("config.json"),
        }
    }

    pub fn load(&self) -> AppConfig {
        if let Ok(content) = fs::read_to_string(&self.file_path) {
            if let Ok(parsed) = serde_json::from_str::<AppConfig>(&content) {
                return parsed;
            }
        }
        let def = default_config();
        let _ = self.save(&def);
        def
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), String> {
        let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(&self.file_path, json).map_err(|e| e.to_string())
    }
}
