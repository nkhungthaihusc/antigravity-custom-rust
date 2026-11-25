use rand::RngCore;
use scrypt::{scrypt, Params};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime};
use subtle::ConstantTimeEq;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRecord {
    pub algorithm: String,
    pub salt: String,
    pub hash: String,
    #[serde(default)]
    pub failures: u32,
    #[serde(rename = "lockedUntil", default)]
    pub locked_until: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityStatus {
    pub configured: bool,
    pub unlocked: bool,
    #[serde(rename = "retryAfterMs")]
    pub retry_after_ms: u64,
}

fn scrypt_params() -> Params {
    // N = 2^15 = 32768, r = 8, p = 1, len = 64
    Params::new(15, 8, 1, 64).expect("Valid scrypt parameters")
}

fn validate_password(password: &str) -> Result<(), String> {
    if !(8..=256).contains(&password.encode_utf16().count()) {
        return Err("Mật khẩu cần từ 8 đến 256 ký tự.".into());
    }
    Ok(())
}

fn valid_record(record: &SecurityRecord) -> bool {
    record.algorithm == "scrypt-v1"
        && record.salt.len() == 32
        && hex::decode(&record.salt).is_ok()
        && record.hash.len() == 128
        && hex::decode(&record.hash).is_ok()
        && record.failures <= 20
}

// Shared with Node's Security.exclusive, so a verification cannot overwrite a
// password changed by the other process while scrypt was running.
struct CredentialLock(PathBuf);
impl CredentialLock {
    fn acquire(file: &Path) -> Result<Self, String> {
        let lock = file.with_file_name("security.json.lock");
        fs::create_dir_all(file.parent().ok_or("Đường dẫn dữ liệu không hợp lệ.")?)
            .map_err(|e| e.to_string())?;
        let start = Instant::now();
        loop {
            match fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&lock)
            {
                Ok(_) => return Ok(Self(lock)),
                Err(error)
                    if error.kind() == ErrorKind::AlreadyExists
                        && start.elapsed() < Duration::from_secs(10) =>
                {
                    std::thread::sleep(Duration::from_millis(25));
                }
                Err(error) => {
                    return Err(format!(
                        "Không thể khóa dữ liệu mật khẩu dùng chung: {error}"
                    ))
                }
            }
        }
    }
}
impl Drop for CredentialLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

pub fn hash_password(password: &str) -> Result<SecurityRecord, String> {
    validate_password(password)?;

    let mut salt_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_bytes);
    let salt_hex = hex::encode(salt_bytes);

    let mut output = [0u8; 64];
    let params = scrypt_params();
    // Node has always passed the stored hex string to crypto.scrypt as UTF-8.
    scrypt(
        password.as_bytes(),
        salt_hex.as_bytes(),
        &params,
        &mut output,
    )
    .map_err(|e| format!("Scrypt error: {:?}", e))?;

    Ok(SecurityRecord {
        algorithm: "scrypt-v1".into(),
        salt: salt_hex,
        hash: hex::encode(output),
        failures: 0,
        locked_until: 0,
    })
}

pub fn verify_password(password: &str, record: &SecurityRecord) -> bool {
    if password.encode_utf16().count() > 256 || !valid_record(record) {
        return false;
    }
    let salt_bytes = match hex::decode(&record.salt) {
        Ok(b) if b.len() == 16 => b,
        _ => return false,
    };
    let expected_hash = match hex::decode(&record.hash) {
        Ok(b) if b.len() == 64 => b,
        _ => return false,
    };

    let mut output = [0u8; 64];
    let params = scrypt_params();
    if scrypt(
        password.as_bytes(),
        record.salt.as_bytes(),
        &params,
        &mut output,
    )
    .is_err()
    {
        return false;
    }

    if bool::from(output.ct_eq(&expected_hash)) {
        return true;
    }
    // v0.5.0 Rust used raw salt bytes with the same algorithm label. Preserve
    // those existing passwords; new records always use the Node-compatible form.
    scrypt(password.as_bytes(), &salt_bytes, &params, &mut output).is_ok()
        && bool::from(output.ct_eq(&expected_hash))
}

pub struct SecurityManager {
    file_path: PathBuf,
    session_until: u64,
}

impl SecurityManager {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            file_path: data_dir.join("security.json"),
            session_until: 0,
        }
    }

    pub fn load_record(&self) -> Result<Option<SecurityRecord>, String> {
        let content = match fs::read_to_string(&self.file_path) {
            Ok(value) => value,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(format!("Không đọc được dữ liệu mật khẩu: {error}")),
        };
        let record: SecurityRecord = serde_json::from_str(&content)
            .map_err(|_| "Dữ liệu mật khẩu hỏng; không được tạo đè mật khẩu mới.".to_string())?;
        if !valid_record(&record) {
            return Err("Dữ liệu mật khẩu không hợp lệ.".into());
        }
        Ok(Some(record))
    }

    pub fn save_record(&self, record: &SecurityRecord) -> Result<(), String> {
        let json = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
        let temp = self
            .file_path
            .with_file_name(format!("security.json.{}.tmp", rand::random::<u64>()));
        let result = (|| {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            file.write_all(json.as_bytes())?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temp, &self.file_path)
        })();
        let _ = fs::remove_file(&temp);
        result.map_err(|e: std::io::Error| e.to_string())
    }

    pub fn is_unlocked(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.session_until > now
    }

    pub fn status(&self) -> Result<SecurityStatus, String> {
        let rec = self.load_record()?;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let retry_after = rec
            .as_ref()
            .map(|r| r.locked_until.saturating_sub(now))
            .unwrap_or(0);

        Ok(SecurityStatus {
            configured: rec.is_some(),
            unlocked: self.is_unlocked(),
            retry_after_ms: retry_after,
        })
    }

    pub fn require(&mut self) -> Result<(), String> {
        if !self.is_unlocked() {
            return Err("Phiên đã khóa. Hãy đăng nhập lại.".into());
        }
        self.session_until = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
            + 30 * 60 * 1000;
        Ok(())
    }

    pub fn setup(&mut self, password: &str) -> Result<SecurityStatus, String> {
        let _lock = CredentialLock::acquire(&self.file_path)?;
        if self.load_record()?.is_some() {
            return Err("Mật khẩu đã được thiết lập.".into());
        }
        let record = hash_password(password)?;
        self.save_record(&record)?;

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.session_until = now + 30 * 60 * 1000;
        self.status()
    }

    pub fn verify(&mut self, password: &str) -> Result<SecurityStatus, String> {
        let _lock = CredentialLock::acquire(&self.file_path)?;
        let mut rec = self.load_record()?.ok_or("Hãy thiết lập mật khẩu trước.")?;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if rec.locked_until > now {
            let sec = ((rec.locked_until - now) as f64 / 1000.0).ceil() as u64;
            return Err(format!("Thử lại sau {} giây.", sec));
        }

        if verify_password(password, &rec) {
            rec.failures = 0;
            rec.locked_until = 0;
            self.save_record(&rec)?;
            self.session_until = now + 30 * 60 * 1000;
            self.status()
        } else {
            rec.failures = (rec.failures + 1).min(20);
            if rec.failures >= 5 {
                let delay = (30000u64 * 2u64.pow(rec.failures - 5)).min(300000);
                rec.locked_until = now + delay;
            }
            self.save_record(&rec)?;
            if rec.locked_until > 0 {
                Err("Sai mật khẩu 5 lần trở lên. Tạm khóa ít nhất 30 giây.".into())
            } else {
                Err("Mật khẩu chưa đúng.".into())
            }
        }
    }

    pub fn lock(&mut self) {
        self.session_until = 0;
    }

    pub fn change_password(&mut self, current: &str, next: &str) -> Result<bool, String> {
        self.require()?;
        let _lock = CredentialLock::acquire(&self.file_path)?;
        validate_password(next)?;
        let rec = self.load_record()?.ok_or("Chưa thiết lập mật khẩu.")?;
        if !verify_password(current, &rec) {
            return Err("Mật khẩu hiện tại chưa đúng.".into());
        }
        let mut new_rec = hash_password(next)?;
        new_rec.failures = 0;
        new_rec.locked_until = 0;
        self.save_record(&new_rec)?;
        Ok(true)
    }
}
