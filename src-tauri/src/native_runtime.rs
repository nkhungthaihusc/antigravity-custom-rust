use std::path::{Path, PathBuf};

#[derive(Debug)]
pub struct NativeRuntime {
    pub node: PathBuf,
    pub root: PathBuf,
}

// Release builds never fall back to a build-machine path or Node on PATH.
pub fn resolve(executable: &Path, development_root: Option<&Path>) -> Result<NativeRuntime, String> {
    let root = executable.parent().ok_or("Không xác định được thư mục launcher.")?.join("runtime");
    if root.exists() {
        let marker = std::fs::read(root.join("bundle.json"))
            .ok().and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
        if marker.as_ref().and_then(|v| v["product"].as_str()) != Some("antigravity-custom-portable") {
            return Err("Bộ tài nguyên runtime không hợp lệ. Hãy giải nén lại toàn bộ ZIP.".into());
        }
        let node = root.join("node/node.exe");
        for file in [&node, &root.join("scripts/native-install.cjs"), &root.join("src/native/installer.cjs")] {
            if !file.is_file() { return Err("Thiếu file trong runtime. Hãy giải nén toàn bộ ZIP và giữ runtime cạnh launcher.".into()); }
        }
        return Ok(NativeRuntime { node, root });
    }
    if let Some(project) = development_root {
        return Ok(NativeRuntime { node: "node".into(), root: project.to_path_buf() });
    }
    Err("Không tìm thấy runtime. Hãy giải nén toàn bộ ZIP, không chỉ chép riêng file EXE.".into())
}

pub fn current() -> Result<NativeRuntime, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    #[cfg(debug_assertions)]
    let development = Some(Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap());
    #[cfg(not(debug_assertions))]
    let development = None;
    resolve(&executable, development)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relocated_bundle_is_preferred_and_incomplete_bundles_fail_closed() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("Giải nén ở nơi khác");
        let exe = directory.join("Antigravity Custom.exe");
        assert!(resolve(&exe, None).unwrap_err().contains("ZIP"));
        let root = directory.join("runtime");
        for name in ["node", "scripts", "src/native"] { std::fs::create_dir_all(root.join(name)).unwrap(); }
        std::fs::write(root.join("bundle.json"), r#"{"product":"antigravity-custom-portable"}"#).unwrap();
        assert!(resolve(&exe, Some(Path::new("unused-source"))).is_err());
        for name in ["node/node.exe", "scripts/native-install.cjs", "src/native/installer.cjs"] { std::fs::write(root.join(name), "fixture").unwrap(); }
        let runtime = resolve(&exe, Some(Path::new("unused-source"))).unwrap();
        assert_eq!(runtime.root, root);
        assert_eq!(runtime.node, root.join("node/node.exe"));
        std::fs::write(root.join("bundle.json"), "{}").unwrap();
        assert!(resolve(&exe, None).is_err());
    }
}
