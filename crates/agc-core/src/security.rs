use rand::RngCore;
use scrypt::{scrypt, Params};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
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

pub fn hash_password(password: &str) -> Result<SecurityRecord, String> {
    if password.len() < 8 || password.len() > 256 {
        return Err("Mật khẩu cần từ 8 đến 256 ký tự.".into());
    }

    let mut salt_bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_bytes);
    let salt_hex = hex::encode(salt_bytes);

    let mut output = [0u8; 64];
    let params = scrypt_params();
    scrypt(password.as_bytes(), &salt_bytes, &params, &mut output)
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
    if password.len() > 256 || record.algorithm != "scrypt-v1" {
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
    if scrypt(password.as_bytes(), &salt_bytes, &params, &mut output).is_err() {
        return false;
    }

    output.ct_eq(&expected_hash).into()
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

    pub fn load_record(&self) -> Option<SecurityRecord> {
        let content = fs::read_to_string(&self.file_path).ok()?;
        serde_json::from_str(&content).ok()
    }

    pub fn save_record(&self, record: &SecurityRecord) -> Result<(), String> {
        let json = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
        fs::write(&self.file_path, json).map_err(|e| e.to_string())
    }

    pub fn is_unlocked(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.session_until > now
    }

    pub fn status(&self) -> SecurityStatus {
        let rec = self.load_record();
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let retry_after = rec
            .as_ref()
            .map(|r| r.locked_until.saturating_sub(now))
            .unwrap_or(0);

        SecurityStatus {
            configured: rec.is_some(),
            unlocked: self.is_unlocked(),
            retry_after_ms: retry_after,
        }
    }

    pub fn setup(&mut self, password: &str) -> Result<SecurityStatus, String> {
        if self.load_record().is_some() {
            return Err("Mật khẩu đã được thiết lập.".into());
        }
        let record = hash_password(password)?;
        self.save_record(&record)?;

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.session_until = now + 30 * 60 * 1000;
        Ok(self.status())
    }

    pub fn verify(&mut self, password: &str) -> Result<SecurityStatus, String> {
        let mut rec = self.load_record().ok_or("Hãy thiết lập mật khẩu trước.")?;
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
            Ok(self.status())
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
        if !self.is_unlocked() {
            return Err("Phiên đã khóa. Hãy đăng nhập lại.".into());
        }
        let rec = self.load_record().ok_or("Chưa thiết lập mật khẩu.")?;
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
