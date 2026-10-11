//! Cloud requests only reach our fixed HTTPS origin. Sessions stay in memory;
//! passwords/cookies are never written to files or returned to the frontend.
use std::{fs, sync::Mutex, time::Duration};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

pub struct AccountState {
    pub active: Mutex<String>,
    client: reqwest::Client,
}
impl Default for AccountState {
    fn default() -> Self {
        Self { active: Mutex::new(String::new()), client: reqwest::Client::builder()
            .cookie_store(true).timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none()).build().expect("HTTPS client") }
    }
}
fn allowed(path: &str, method: &str) -> bool {
    match (method, path) {
        ("GET", "account/features" | "auth/get-session" | "developer/me" | "cloud/data" | "cloud/manifest" | "content") => true,
        ("POST", "auth/sign-in/email" | "auth/sign-up/email" | "auth/sign-out" |
            "auth/request-password-reset" | "recovery/create" | "recovery/reset") => true,
        ("PUT", "cloud/data") => true,
        ("GET" | "PUT", p) if p.starts_with("cloud/asset:") => {
            let h = &p[12..]; h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit())
        },
        _ => false,
    }
}
#[tauri::command]
pub async fn account_request(app: AppHandle, path: String, method: String, body: Option<Value>, account: Option<String>) -> Result<Value, String> {
    if !allowed(&path, &method) { return Err("Unsupported account request".into()); }
    let client = app.state::<AccountState>().client.clone();
    let mut request = client.request(method.parse::<reqwest::Method>().map_err(|_| "Invalid method")?,
        format!("https://lucidrank.pages.dev/api/{path}"))
        .header("Origin", "https://lucidrank.pages.dev")
        .header("Content-Type", "application/json");
    if let Some(id) = account { request = request.header("X-LucidRank-Account", id); }
    if let Some(data) = body { request = request.json(&data); }
    let response = request.send().await.map_err(|_| "Account connection failed")?;
    let status = response.status().as_u16();
    let value: Value = response.json().await.map_err(|_| "Invalid account response")?;
    Ok(json!({"status": status, "body": value}))
}
#[tauri::command]
// This selects local files only; cloud authorization is verified independently by the server.
pub async fn account_select(app: AppHandle, account: String) -> Result<(), String> {
    if !account.is_empty() {
        if account.len() > 128 || !account.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
            return Err("Invalid account".into());
        }

    }
    let previous=app.state::<AccountState>().active.lock().map_err(|_| "Account unavailable")?.clone();
    if previous != account {for label in ["checkin","lineups"] {if let Some(w)=app.get_webview_window(label){let _=w.close();}}}
    *app.state::<AccountState>().active.lock().map_err(|_| "Account unavailable")? = account;
    let _=app.emit("data-changed",json!({"from":"account"}));
    Ok(())
}
#[tauri::command]
pub fn account_meta(app: AppHandle, key: String, value: Option<Value>, write: bool) -> Result<Value, String> {
    if key.len() > 200 || !key.starts_with("sync:") || !key.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_:".contains(&b)) {
        return Err("Invalid metadata key".into());
    }
    let state = app.state::<super::AppState>();
    let _guard = state.io.lock().map_err(|_| "Storage unavailable")?;
    let dir = super::data_dir(&app).join("accounts"); fs::create_dir_all(&dir).map_err(|_| "Storage unavailable")?;
    let name: String = key.bytes().map(|b| format!("{b:02x}")).collect();
    let file = dir.join(format!("{name}.json"));
    if write { super::write_json(&file, &value.unwrap_or(Value::Null))?; }
    Ok(if file.exists() { super::read_json(&file) } else { Value::Null })
}
#[tauri::command]
pub fn open_website(page: String) -> Result<(), String> {
    let url = match page.as_str() {
        "home" => "https://lucidrank.pages.dev/",
        "developer" => "https://lucidrank.pages.dev/app/developer.html",
        _ => return Err("Unsupported page".into()),
    };
    #[cfg(target_os="windows")]
    std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn().map_err(|_| "Cannot open browser")?;
    #[cfg(target_os="macos")]
    std::process::Command::new("open").arg(url).spawn().map_err(|_| "Cannot open browser")?;
    #[cfg(target_os="linux")]
    std::process::Command::new("xdg-open").arg(url).spawn().map_err(|_| "Cannot open browser")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn fixed_routes() {
        assert!(allowed("auth/sign-in/email", "POST"));
        assert!(allowed(&format!("cloud/asset:{}", "a".repeat(64)), "PUT"));
        assert!(!allowed("https://example.com", "GET"));
        assert!(!allowed("cloud/asset:../../secret", "GET"));
        assert!(!allowed("auth/delete-user", "POST"));
    }
}
