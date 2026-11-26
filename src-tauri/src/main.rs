// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agc_core::config::{default_builtins, AppConfig, ConfigStore};
use agc_core::get_data_dir;
use agc_core::quota::{get_live_quota, LiveQuota};
use agc_core::security::{SecurityManager, SecurityStatus};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
mod native_runtime;

struct AppState {
    data_dir: PathBuf,
    security: Mutex<SecurityManager>,
}

fn detect_antigravity_executable() -> Option<String> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let path = PathBuf::from(local_app_data)
        .join("Programs")
        .join("Antigravity")
        .join("Antigravity.exe");
    if path.exists() {
        Some(path.to_string_lossy().to_string())
    } else {
        None
    }
}

fn native_command(action: &str, data_dir: Option<&std::path::Path>) -> Result<std::process::Output, String> {
    let runtime = native_runtime::current()?;
    let mut command = std::process::Command::new(&runtime.node);
    command.current_dir(&runtime.root)
        .env_remove("NODE_OPTIONS").env_remove("NODE_PATH").env_remove("ELECTRON_RUN_AS_NODE")
        .arg(runtime.root.join("scripts/native-install.cjs")).arg(action);
    if let Some(directory) = data_dir { command.env("AGC_DATA_DIRECTORY", directory); }
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command.output().map_err(|e| format!("Không chạy được bộ tích hợp: {}", e))
}

fn native_status() -> serde_json::Value {
    match native_command("status", None) {
        Ok(output) if output.status.success() => serde_json::from_slice(&output.stdout).unwrap_or_else(|_| serde_json::json!({"installed":false,"error":"Không đọc được trạng thái tích hợp"})),
        Ok(output) => serde_json::json!({"installed":false,"error":String::from_utf8_lossy(&output.stderr).trim()}),
        Err(error) => serde_json::json!({"installed":false,"error":error}),
    }
}

#[tauri::command]
fn get_quota() -> LiveQuota {
    get_live_quota()
}

#[tauri::command]
fn bootstrap(state: State<AppState>) -> Result<serde_json::Value, String> {
    let security = state.security.lock().unwrap();
    let store = ConfigStore::new(&state.data_dir);
    let config = store.load();
    let security_status = security.status()?;
    let detected_path = detect_antigravity_executable().unwrap_or_default();

    Ok(serde_json::json!({
        "config": config,
        "security": security_status,
        "builtins": default_builtins(),
        "appVersion": "0.5.0",
        "hostMode": "tauri-native",
        "detectedPath": detected_path,
        "nativeStatus": native_status(),
        "integration": {
            "state": "native",
            "message": "Trình quản lý Rust Native đang kết nối."
        }
    }))
}

#[tauri::command]
fn setup_password(state: State<AppState>, password: String) -> Result<SecurityStatus, String> {
    let mut security = state.security.lock().unwrap();
    security.setup(&password)
}

#[tauri::command]
fn unlock(state: State<AppState>, password: String) -> Result<SecurityStatus, String> {
    let mut security = state.security.lock().unwrap();
    security.verify(&password)
}

#[tauri::command]
fn lock(state: State<AppState>) -> Result<SecurityStatus, String> {
    let mut security = state.security.lock().unwrap();
    security.lock();
    security.status()
}

#[tauri::command]
fn save(state: State<AppState>, mut config: AppConfig) -> Result<serde_json::Value, String> {
    state.security.lock().unwrap().require()?;
    config.splash.music_scope = "startup".into();
    let store = ConfigStore::new(&state.data_dir);
    store.save(&config)?;
    bootstrap(state)
}

#[tauri::command]
fn change_password(state: State<AppState>, current: String, next: String) -> Result<bool, String> {
    let mut security = state.security.lock().unwrap();
    security.change_password(&current, &next)
}

#[tauri::command]
fn launch(state: State<AppState>) -> Result<serde_json::Value, String> {
    state.security.lock().unwrap().require()?;
    let status = native_status();
    if status["supported"] != true {
        return Err(status["error"].as_str().unwrap_or("Bản Antigravity App chưa được hỗ trợ hoặc chưa kiểm tra được tích hợp.").to_string());
    }
    if status["installed"] != true || status["updateAvailable"] == true {
        let output = native_command("install", Some(&state.data_dir))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
    }
    let exe = detect_antigravity_executable().ok_or("Không tìm thấy file Antigravity.exe")?;
    std::process::Command::new(exe)
        .spawn()
        .map_err(|e| format!("Không thể khởi chạy Antigravity: {}", e))?;
    Ok(serde_json::json!({
        "started": true,
        "stayInWindow": false,
        "message": "Đã mở Antigravity App thành công."
    }))
}

#[tauri::command]
fn minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_data(state: State<AppState>) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&state.data_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn preview_audio(state: State<AppState>) -> Result<Option<agc_core::audio::PreviewAudio>, String> {
    let mut security = state.security.lock().unwrap();
    security.require()?;
    let config = ConfigStore::new(&state.data_dir).load();
    agc_core::audio::preview_audio(&state.data_dir, &config, &mut security)
}

#[tauri::command]
fn native_install(state: State<AppState>) -> Result<serde_json::Value, String> {
    state.security.lock().unwrap().require()?;
    let output = native_command("install", Some(&state.data_dir))?;
    if output.status.success() { bootstrap(state) }
    else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

#[tauri::command]
fn native_uninstall(state: State<AppState>) -> Result<serde_json::Value, String> {
    state.security.lock().unwrap().require()?;
    let output = native_command("uninstall", Some(&state.data_dir))?;
    if output.status.success() { bootstrap(state) }
    else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

fn main() {
    // Read-only release diagnostic; never loads credentials or installs anything.
    if std::env::args_os().nth(1).as_deref() == Some(std::ffi::OsStr::new("--check-package")) {
        let result = match native_runtime::current() {
            Ok(_) => serde_json::json!({"packageReady":true,"nativeStatus":native_status()}),
            Err(error) => serde_json::json!({"packageReady":false,"error":error}),
        };
        println!("{}", result);
        std::process::exit(if result["packageReady"] == true && result["nativeStatus"]["error"].is_null() { 0 } else { 1 });
    }
    let data_dir = get_data_dir().expect("Không thể mở thư mục dữ liệu dùng chung với Antigravity");
    let security = Mutex::new(SecurityManager::new(&data_dir));

    tauri::Builder::default()
        .manage(AppState { data_dir, security })
        .invoke_handler(tauri::generate_handler![
            get_quota,
            bootstrap,
            setup_password,
            unlock,
            lock,
            save,
            change_password,
            launch,
            minimize,
            open_data,
            preview_audio,
            native_install,
            native_uninstall
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
