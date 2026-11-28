use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveQuota {
    pub plan: String,
    pub gemini5h: u32,
    pub geminiWeek: u32,
    #[serde(rename = "gemini5hResetAt", skip_serializing_if = "Option::is_none")]
    pub gemini_5h_reset_at: Option<u64>,
    #[serde(rename = "geminiWeekResetAt", skip_serializing_if = "Option::is_none")]
    pub gemini_week_reset_at: Option<u64>,
    pub codex5h: u32,
    pub codexWeek: u32,
    #[serde(rename = "codex5hResetAt", skip_serializing_if = "Option::is_none")]
    pub codex_5h_reset_at: Option<u64>,
    #[serde(rename = "codexWeekResetAt", skip_serializing_if = "Option::is_none")]
    pub codex_week_reset_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct RateLimitBucket {
    used_percent: Option<f64>,
    resets_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct RateLimitsPayload {
    primary: Option<RateLimitBucket>,
    secondary: Option<RateLimitBucket>,
}

#[derive(Debug, Deserialize)]
struct LogLine {
    rate_limits: Option<RateLimitsPayload>,
    payload: Option<InnerPayload>,
}

#[derive(Debug, Deserialize)]
struct InnerPayload {
    rate_limits: Option<RateLimitsPayload>,
}

fn calc_remaining(bucket: &Option<RateLimitBucket>, now_sec: u64) -> Option<u32> {
    if let Some(b) = bucket {
        if let Some(used) = b.used_percent {
            if let Some(reset) = b.resets_at {
                if now_sec > reset {
                    return Some(100);
                }
            }
            let rem = (100.0 - used).round().clamp(0.0, 100.0) as u32;
            return Some(rem);
        }
    }
    None
}

pub fn find_newest_session_files(dir: &Path, max_files: usize) -> Vec<PathBuf> {
    let mut files = Vec::new();
    walk_sessions(dir, &mut files);
    files.sort_by(|a, b| b.1.cmp(&a.1));
    files.into_iter().take(max_files).map(|(p, _)| p).collect()
}

fn walk_sessions(dir: &Path, acc: &mut Vec<(PathBuf, SystemTime)>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_sessions(&path, acc);
            } else if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(mtime) = metadata.modified() {
                        acc.push((path, mtime));
                    }
                }
            }
        }
    }
}

pub struct CodexLimits {
    pub codex5h: u32,
    pub codex_week: u32,
    pub codex_5h_reset_at: Option<u64>,
    pub codex_week_reset_at: Option<u64>,
}

pub fn read_codex_quota_full() -> Option<CodexLimits> {
    let home = directories::BaseDirs::new()?.home_dir().to_path_buf();
    let sessions_dir = home.join(".codex").join("sessions");
    let files = find_newest_session_files(&sessions_dir, 8);
    let now_sec = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    for file_path in files {
        if let Ok(file) = File::open(&file_path) {
            let reader = BufReader::new(file);
            let lines: Vec<String> = reader.lines().flatten().collect();
            for line in lines.iter().rev() {
                if !line.contains("rate_limits") {
                    continue;
                }
                if let Ok(parsed) = serde_json::from_str::<LogLine>(line) {
                    let rl = parsed
                        .rate_limits
                        .or_else(|| parsed.payload.and_then(|p| p.rate_limits));
                    if let Some(limits) = rl {
                        let c5 = calc_remaining(&limits.primary, now_sec);
                        let cw = calc_remaining(&limits.secondary, now_sec);
                        if c5.is_some() || cw.is_some() {
                            return Some(CodexLimits {
                                codex5h: c5.unwrap_or(100),
                                codex_week: cw.unwrap_or(100),
                                codex_5h_reset_at: limits.primary.and_then(|b| b.resets_at),
                                codex_week_reset_at: limits.secondary.and_then(|b| b.resets_at),
                            });
                        }
                    }
                }
            }
        }
    }
    None
}

pub fn read_codex_quota() -> Option<(u32, u32)> {
    read_codex_quota_full().map(|l| (l.codex5h, l.codex_week))
}

pub fn get_live_quota() -> LiveQuota {
    let codex = read_codex_quota_full();
    let now_sec = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    LiveQuota {
        plan: "Google AI Pro".into(),
        gemini5h: 83,
        geminiWeek: 71,
        gemini_5h_reset_at: Some(now_sec + 5640),
        gemini_week_reset_at: Some(now_sec + 514800),
        codex5h: codex.as_ref().map(|c| c.codex5h).unwrap_or(100),
        codexWeek: codex.as_ref().map(|c| c.codex_week).unwrap_or(100),
        codex_5h_reset_at: codex.as_ref().and_then(|c| c.codex_5h_reset_at),
        codex_week_reset_at: codex.as_ref().and_then(|c| c.codex_week_reset_at),
    }
}
