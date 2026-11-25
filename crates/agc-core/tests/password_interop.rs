use agc_core::security::{verify_password, SecurityManager, SecurityRecord};
use std::{
    fs,
    path::Path,
    process::Command,
    time::{Duration, Instant},
};

fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!("../../../test/fixtures/security-v1.json")).unwrap()
}

fn peer(directory: &Path, action: &str, current: &str, next: &str) -> bool {
    Command::new("node")
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/password-peer.cjs"))
        .args([directory.to_str().unwrap(), action, current, next])
        .output()
        .expect("Node is required for the password compatibility tests")
        .status
        .success()
}

#[test]
fn existing_node_and_legacy_rust_passwords_remain_valid() {
    let data = fixture();
    for key in ["node", "legacyRust"] {
        let record: SecurityRecord = serde_json::from_value(data[key].clone()).unwrap();
        assert!(verify_password(data["password"].as_str().unwrap(), &record));
        assert!(!verify_password("incorrect-password", &record));
    }
}

#[test]
fn password_changes_propagate_both_ways_without_restarting_either_authority() {
    let temp = tempfile::tempdir().unwrap();
    let mut launcher = SecurityManager::new(temp.path());
    launcher.setup("original-password").unwrap();
    assert!(peer(
        temp.path(),
        "change",
        "original-password",
        "node-password"
    ));
    assert!(launcher.verify("original-password").is_err());
    launcher.verify("node-password").unwrap();
    launcher
        .change_password("node-password", "rust-password")
        .unwrap();
    assert!(!peer(temp.path(), "verify", "node-password", ""));
    assert!(peer(temp.path(), "verify", "rust-password", ""));
    let record = launcher.load_record().unwrap().unwrap();
    assert_eq!(record.failures, 0);
}

#[test]
fn node_and_rust_share_the_same_cross_process_lock() {
    let temp = tempfile::tempdir().unwrap();
    let mut child = Command::new("node")
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/password-peer.cjs"))
        .arg(temp.path())
        .arg("hold-setup")
        .stdout(std::process::Stdio::null())
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    while !temp.path().join("peer-ready").exists() {
        assert!(
            Instant::now() < deadline,
            "Node peer did not acquire its lock"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
    let mut launcher = SecurityManager::new(temp.path());
    assert!(launcher
        .setup("must-not-overwrite")
        .unwrap_err()
        .contains("đã được"));
    assert!(child.wait().unwrap().success());
    assert!(!temp.path().join("security.json.lock").exists());
}

#[test]
fn corrupt_credentials_fail_closed_and_locked_commands_are_rejected() {
    let temp = tempfile::tempdir().unwrap();
    let mut launcher = SecurityManager::new(temp.path());
    assert!(launcher.require().is_err());
    fs::write(temp.path().join("security.json"), "{}").unwrap();
    assert!(launcher.status().is_err());
    assert!(launcher.setup("must-not-overwrite").is_err());
    assert_eq!(
        fs::read_to_string(temp.path().join("security.json")).unwrap(),
        "{}"
    );
    assert!(!temp.path().join("security.json.lock").exists());
}
