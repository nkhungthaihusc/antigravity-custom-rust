use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

// The installed community manifest is the native runtime's source of truth.
// Do not fall back to a second profile when that manifest is unreadable/corrupt.
pub fn resolve_data_dir(local: &Path, roaming: &Path) -> Result<PathBuf, String> {
    let manifest = local.join("Programs/Antigravity/resources/agc-custom/install.json");
    match fs::read(&manifest) {
        Ok(bytes) => {
            let value: serde_json::Value = serde_json::from_slice(&bytes)
                .map_err(|_| "Manifest tích hợp native bị hỏng.".to_string())?;
            let directory = value["dataDirectory"].as_str().map(PathBuf::from);
            match directory {
                Some(path)
                    if value["product"] == "antigravity-custom-native" && path.is_absolute() =>
                {
                    Ok(path)
                }
                _ => Err("Thư mục dữ liệu trong manifest native không hợp lệ.".into()),
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(roaming.join("antigravity-custom")),
        Err(error) => Err(format!("Không đọc được manifest native: {error}")),
    }
}

pub fn get_data_dir() -> Result<PathBuf, String> {
    let dir = match (
        std::env::var_os("LOCALAPPDATA"),
        std::env::var_os("APPDATA"),
    ) {
        (Some(local), Some(roaming)) => resolve_data_dir(Path::new(&local), Path::new(&roaming))?,
        _ => directories::BaseDirs::new()
            .ok_or("Không tìm thấy thư mục dữ liệu người dùng.")?
            .config_dir()
            .join("antigravity-custom"),
    };
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Không mở được thư mục dữ liệu dùng chung: {e}"))?;
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_profile_follows_native_manifest_and_refuses_corruption() {
        let temp = tempfile::tempdir().unwrap();
        let local = temp.path().join("local");
        let roaming = temp.path().join("roaming");
        assert_eq!(
            resolve_data_dir(&local, &roaming).unwrap(),
            roaming.join("antigravity-custom")
        );
        let manifest = local.join("Programs/Antigravity/resources/agc-custom/install.json");
        fs::create_dir_all(manifest.parent().unwrap()).unwrap();
        let custom = temp.path().join("existing-native-profile");
        fs::write(
            &manifest,
            serde_json::json!({"product":"antigravity-custom-native","dataDirectory":custom})
                .to_string(),
        )
        .unwrap();
        assert_eq!(resolve_data_dir(&local, &roaming).unwrap(), custom);
        for content in [
            "{broken",
            r#"{"product":"antigravity-custom-native","dataDirectory":"relative"}"#,
        ] {
            fs::write(&manifest, content).unwrap();
            assert!(resolve_data_dir(&local, &roaming).is_err());
        }
    }
}
