use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::paths::canonicalize_or;

const MANIFEST_FILE: &str = ".htmlshare";
const MANIFEST_VERSION: &str = "1";

fn api_base() -> String {
    std::env::var("HTMLB_SHARE_API")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "https://htmlbrowser.dev".to_string())
}

// ---------- local .htmlshare manifest ----------

#[derive(Debug, Serialize, Deserialize)]
struct Manifest {
    #[serde(default = "default_version")]
    version: String,
    #[serde(default)]
    documents: BTreeMap<String, ManifestEntry>,
}

fn default_version() -> String {
    MANIFEST_VERSION.to_string()
}

impl Default for Manifest {
    fn default() -> Self {
        Manifest {
            version: default_version(),
            documents: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestEntry {
    doc_id: String,
    token: String,
    url: String,
    created_at: String,
    updated_at: String,
}

fn manifest_path(root: &Path) -> PathBuf {
    root.join(MANIFEST_FILE)
}

fn read_manifest(root: &Path) -> Manifest {
    fs::read_to_string(manifest_path(root))
        .ok()
        .and_then(|s| serde_json::from_str::<Manifest>(&s).ok())
        .unwrap_or_default()
}

fn write_manifest(root: &Path, manifest: &Manifest) -> Result<(), String> {
    let json = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(manifest_path(root), json).map_err(|e| e.to_string())
}

/// Key a file by its path relative to the manifest (workspace) root.
fn manifest_key(root: &Path, file: &Path) -> Result<String, String> {
    let rel = file
        .strip_prefix(root)
        .map_err(|_| "File is outside the current workspace".to_string())?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn now_iso() -> String {
    // RFC3339-ish UTC timestamp without pulling in chrono.
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let days = secs / 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    let h = (secs % 86_400) / 3600;
    let min = (secs % 3600) / 60;
    let s = secs % 60;
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}Z")
}

// Howard Hinnant's days-from-civil, inverted. Good enough for a timestamp.
fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

// ---------- API payloads ----------

#[derive(Serialize)]
struct UploadBody {
    content: String,
    filename: Option<String>,
}

#[derive(Serialize)]
struct UpdateBody {
    #[serde(rename = "docId")]
    doc_id: String,
    token: String,
    content: String,
    message: Option<String>,
}

#[derive(Deserialize)]
struct UploadResp {
    #[serde(rename = "docId")]
    doc_id: String,
    token: String,
    url: String,
    version: u32,
}

#[derive(Deserialize)]
struct UpdateResp {
    #[serde(rename = "docId")]
    #[allow(dead_code)]
    doc_id: String,
    url: String,
    version: u32,
}

#[derive(Deserialize)]
struct ApiErr {
    #[allow(dead_code)]
    error: String,
    message: String,
}

// ---------- command results ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareResult {
    pub doc_id: String,
    pub url: String,
    pub version: u32,
    /// true when this pushed a new version of an already-shared file.
    pub updated: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareStatus {
    pub doc_id: String,
    pub url: String,
}

// ---------- commands ----------

#[tauri::command]
pub async fn get_share_status(
    root: PathBuf,
    path: PathBuf,
) -> Result<Option<ShareStatus>, String> {
    let root = canonicalize_or(&root);
    let file = canonicalize_or(&path);
    let key = manifest_key(&root, &file)?;
    let manifest = read_manifest(&root);
    Ok(manifest.documents.get(&key).map(|e| ShareStatus {
        doc_id: e.doc_id.clone(),
        url: e.url.clone(),
    }))
}

#[tauri::command]
pub async fn share_artifact(
    root: PathBuf,
    path: PathBuf,
    message: Option<String>,
) -> Result<ShareResult, String> {
    let root = canonicalize_or(&root);
    let file = canonicalize_or(&path);
    let key = manifest_key(&root, &file)?;

    let content = fs::read_to_string(&file)
        .map_err(|e| format!("Could not read file: {e}"))?;
    if content.is_empty() {
        return Err("File is empty".to_string());
    }

    let filename = file
        .file_name()
        .map(|n| n.to_string_lossy().to_string());

    let mut manifest = read_manifest(&root);
    let existing = manifest.documents.get(&key).cloned();

    let client = reqwest::Client::new();
    let base = api_base();

    // Already linked -> push an update.
    if let Some(entry) = existing {
        let resp = client
            .post(format!("{base}/api/update"))
            .json(&UpdateBody {
                doc_id: entry.doc_id.clone(),
                token: entry.token.clone(),
                content: content.clone(),
                message: message.clone().filter(|m| !m.is_empty()),
            })
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        if resp.status().as_u16() == 404 {
            // The remote doc no longer exists — re-upload as a fresh share.
            manifest.documents.remove(&key);
        } else if !resp.status().is_success() {
            return Err(api_error_message(resp).await);
        } else {
            let parsed: UpdateResp =
                resp.json().await.map_err(|e| format!("Bad response: {e}"))?;
            let mut updated_entry = entry;
            updated_entry.url = parsed.url.clone();
            updated_entry.updated_at = now_iso();
            manifest.documents.insert(key, updated_entry);
            write_manifest(&root, &manifest)?;
            return Ok(ShareResult {
                doc_id: parsed.doc_id,
                url: parsed.url,
                version: parsed.version,
                updated: true,
            });
        }
    }

    // Fresh upload.
    let resp = client
        .post(format!("{base}/api/upload"))
        .json(&UploadBody {
            content,
            filename,
        })
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(api_error_message(resp).await);
    }

    let parsed: UploadResp = resp.json().await.map_err(|e| format!("Bad response: {e}"))?;
    let now = now_iso();
    manifest.documents.insert(
        key,
        ManifestEntry {
            doc_id: parsed.doc_id.clone(),
            token: parsed.token,
            url: parsed.url.clone(),
            created_at: now.clone(),
            updated_at: now,
        },
    );
    write_manifest(&root, &manifest)?;

    Ok(ShareResult {
        doc_id: parsed.doc_id,
        url: parsed.url,
        version: parsed.version,
        updated: false,
    })
}

async fn api_error_message(resp: reqwest::Response) -> String {
    let status = resp.status().as_u16();
    match resp.json::<ApiErr>().await {
        Ok(err) => err.message,
        Err(_) => format!("Server returned status {status}"),
    }
}
