// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agc_core::config::{default_builtins, AppConfig, ConfigStore};
use agc_core::get_data_dir;
use agc_core::quota::{get_live_quota, LiveQuota};
use agc_core::security::{SecurityManager, SecurityStatus};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

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

fn is_native_installed() -> bool {
    let local_app_data = match std::env::var("LOCALAPPDATA") {
        Ok(v) => v,
        Err(_) => return false,
    };
    let path = PathBuf::from(local_app_data)
        .join("Programs")
        .join("Antigravity")
        .join("resources")
        .join("agc-custom")
        .join("runtime.js");
    path.exists()
}

#[tauri::command]
fn get_quota() -> LiveQuota {
    get_live_quota()
}

#[tauri::command]
fn bootstrap(state: State<AppState>) -> serde_json::Value {
    let security = state.security.lock().unwrap();
    let store = ConfigStore::new(&state.data_dir);
    let config = store.load();
    let security_status = security.status();
    let detected_path = detect_antigravity_executable().unwrap_or_default();

    serde_json::json!({
        "config": config,
        "security": security_status,
        "builtins": default_builtins(),
        "appVersion": "0.5.0",
        "hostMode": "tauri-native",
        "detectedPath": detected_path,
        "nativeStatus": {
            "installed": is_native_installed(),
            "appVersion": "2.35.1"
        },
        "integration": {
            "state": "native",
            "message": "Trình quản lý Rust Native đang kết nối."
        }
    })
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
fn lock(state: State<AppState>) -> SecurityStatus {
    let mut security = state.security.lock().unwrap();
    security.lock();
    security.status()
}

#[tauri::command]
fn save(state: State<AppState>, config: AppConfig) -> Result<serde_json::Value, String> {
    let store = ConfigStore::new(&state.data_dir);
    store.save(&config)?;
    Ok(bootstrap(state))
}

#[tauri::command]
fn change_password(state: State<AppState>, current: String, next: String) -> Result<bool, String> {
    let mut security = state.security.lock().unwrap();
    security.change_password(&current, &next)
}

#[tauri::command]
fn launch() -> Result<serde_json::Value, String> {
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
fn native_install() -> Result<serde_json::Value, String> {
    let status = std::process::Command::new("node")
        .args(["scripts/native-install.cjs", "install"])
        .status()
        .map_err(|e| format!("Lỗi gọi installer: {}", e))?;
    if status.success() {
        Ok(serde_json::json!({ "installed": true, "message": "Đã cài đặt splash native thành công." }))
    } else {
        Err("Cài đặt splash native thất bại. Hãy chắc chắn Antigravity đã đóng hoàn toàn.".into())
    }
}

#[tauri::command]
fn native_uninstall() -> Result<serde_json::Value, String> {
    let status = std::process::Command::new("node")
        .args(["scripts/native-install.cjs", "uninstall"])
        .status()
        .map_err(|e| format!("Lỗi gọi uninstaller: {}", e))?;
    if status.success() {
        Ok(serde_json::json!({ "installed": false, "message": "Đã khôi phục splash gốc." }))
    } else {
        Err("Khôi phục splash gốc thất bại.".into())
    }
}

fn main() {
    let data_dir = get_data_dir();
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
            native_install,
            native_uninstall
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
