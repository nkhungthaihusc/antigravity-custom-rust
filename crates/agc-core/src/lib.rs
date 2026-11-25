pub mod config;
pub mod quota;
pub mod security;

use std::fs;
use std::path::PathBuf;

pub fn get_data_dir() -> PathBuf {
    let dir = directories::ProjectDirs::from("local", "antigravity", "custom")
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(|| {
            let home = directories::BaseDirs::new()
                .map(|b| b.home_dir().to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."));
            home.join(".antigravity-custom")
        });
    let _ = fs::create_dir_all(&dir);
    dir
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_fields() {
        let cfg = config::default_config();
        assert_eq!(cfg.schema_version, 1);
        assert_eq!(cfg.rg.color, "#22d3ee");
        assert_eq!(cfg.rg.unit_name, "WHITE GUNDAM");
        assert_eq!(cfg.rg.audio_mode, "track");
        assert_eq!(cfg.rg.cinematic_mode, "quick");
        assert!(cfg.rg.cue_audio_ids.is_empty());

        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("cueAudioIds"));
        assert!(json.contains("WHITE GUNDAM"));

        let deserialized: config::AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.rg.unit_name, "WHITE GUNDAM");
    }

    #[test]
    fn test_security_flow() {
        let temp = tempfile::tempdir().unwrap();
        let mut sec = security::SecurityManager::new(temp.path());
        assert!(!sec.status().configured);
        assert!(!sec.status().unlocked);

        sec.setup("TestPass@123").unwrap();
        assert!(sec.status().configured);
        assert!(sec.status().unlocked);

        sec.lock();
        assert!(sec.status().configured);
        assert!(!sec.status().unlocked);

        assert!(sec.verify("WrongPass").is_err());
        assert!(!sec.status().unlocked);

        assert!(sec.verify("TestPass@123").is_ok());
        assert!(sec.status().unlocked);

        sec.change_password("TestPass@123", "NewPass@456").unwrap();
        assert!(sec.verify("NewPass@456").is_ok());
    }

    #[test]
    fn test_live_quota() {
        let q = quota::get_live_quota();
        assert!(q.gemini5h <= 100);
        assert!(q.geminiWeek <= 100);
    }
}
