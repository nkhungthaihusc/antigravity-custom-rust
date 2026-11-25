use agc_core::config::ConfigStore;
use agc_core::quota::get_live_quota;
use agc_core::security::SecurityManager;
use agc_core::get_data_dir;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    let data_dir = get_data_dir();
    let mut security = SecurityManager::new(&data_dir);
    let store = ConfigStore::new(&data_dir);

    let command = args.get(1).map(|s| s.as_str()).unwrap_or("help");

    match command {
        "quota" => {
            let quota = get_live_quota();
            if let Ok(json) = serde_json::to_string_pretty(&quota) {
                println!("{}", json);
            }
        }
        "status" => {
            let sec_status = security.status();
            let response = serde_json::json!({
                "security": sec_status,
                "dataDirectory": data_dir.display().to_string(),
                "coreVersion": "0.5.0-rust"
            });
            println!("{}", serde_json::to_string_pretty(&response).unwrap());
        }
        "config" => {
            let cfg = store.load();
            println!("{}", serde_json::to_string_pretty(&cfg).unwrap());
        }
        "verify" => {
            if let Some(pwd) = args.get(2) {
                match security.verify(pwd) {
                    Ok(status) => {
                        println!("{}", serde_json::json!({ "ok": true, "status": status }));
                    }
                    Err(err) => {
                        eprintln!("{}", serde_json::json!({ "ok": false, "error": err }));
                        std::process::exit(1);
                    }
                }
            } else {
                eprintln!("Usage: agc verify <password>");
                std::process::exit(1);
            }
        }
        "setup" => {
            if let Some(pwd) = args.get(2) {
                match security.setup(pwd) {
                    Ok(status) => {
                        println!("{}", serde_json::json!({ "ok": true, "status": status }));
                    }
                    Err(err) => {
                        eprintln!("{}", serde_json::json!({ "ok": false, "error": err }));
                        std::process::exit(1);
                    }
                }
            } else {
                eprintln!("Usage: agc setup <password>");
                std::process::exit(1);
            }
        }
        _ => {
            println!("Antigravity Custom Core (Rust native v0.5.0)");
            println!("Commands:");
            println!("  agc quota           Read live AI Engine quota telemetry");
            println!("  agc status          Get security and runtime status");
            println!("  agc config          Get active configuration");
            println!("  agc verify <pwd>    Verify master password");
            println!("  agc setup <pwd>     Initialize master password");
        }
    }
}
