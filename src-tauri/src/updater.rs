//! In-app updates (tauri-plugin-updater). Nothing here touches games: it downloads one small
//! JSON manifest and, only after the user clicks "Update now", the signed installer.
//!
//! * Endpoints come from `plugins.updater.endpoints` in tauri.conf.json (Cloudflare first, GitHub
//!   second). We try them one by one with a short timeout so a blocked/slow host doesn't hang the check.
//! * The download is verified against `plugins.updater.pubkey` by the plugin (minisign). If one host
//!   stalls or is very slow we switch to the other host's manifest (same file, same signature).
//! * Windows: `install` starts the NSIS installer in passive mode and exits; the installer relaunches
//!   the app. Elsewhere we restart ourselves.
//! * Debug builds only: LR_UPDATE_ENDPOINT=url[,url] overrides the endpoints and LR_UPDATE_DRYRUN=1
//!   stops after download + signature check (used for local tests; never in release builds).

use std::{
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

const CHECK_TIMEOUT: Duration = Duration::from_secs(20);
/// No bytes for this long => give up on this host (longer when it's the last host left).
const STALL: Duration = Duration::from_secs(25);
const STALL_LAST: Duration = Duration::from_secs(90);
/// After this long, if the projected total time is over SLOW_LIMIT, try the next host.
const SLOW_GRACE: Duration = Duration::from_secs(30);
const SLOW_LIMIT: Duration = Duration::from_secs(8 * 60);

#[derive(Default)]
pub struct UpdState {
    /// (index of the endpoint that announced it, the update)
    pending: Mutex<Option<(usize, Update)>>,
    busy: AtomicBool,
}

fn endpoints(app: &AppHandle) -> Vec<Url> {
    #[cfg(debug_assertions)]
    if let Ok(v) = std::env::var("LR_UPDATE_ENDPOINT") {
        return v.split(',').filter_map(|s| s.trim().parse().ok()).collect();
    }
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("endpoints"))
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(|s| s.as_str()?.parse().ok()).collect())
        .unwrap_or_default()
}

fn dry_run() -> bool {
    cfg!(debug_assertions) && std::env::var("LR_UPDATE_DRYRUN").as_deref() == Ok("1")
}

async fn check_one(app: &AppHandle, ep: &Url) -> Result<Option<Update>, String> {
    let up = app
        .updater_builder()
        .endpoints(vec![ep.clone()])
        .map_err(|e| e.to_string())?
        .timeout(CHECK_TIMEOUT)
        .build()
        .map_err(|e| e.to_string())?;
    up.check().await.map_err(|e| e.to_string())
}

fn info(u: &Update) -> Value {
    json!({
        "available": true,
        "version": u.version,
        "current": u.current_version,
        "notes": u.body,
        "date": u.date.map(|d| d.unix_timestamp()),
    })
}

/// Ask the endpoints (in order) whether there is a newer version. The first host that answers wins.
#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<Value, String> {
    let eps = endpoints(&app);
    let mut last_err = String::from("no update endpoints");
    for (i, ep) in eps.iter().enumerate() {
        match check_one(&app, ep).await {
            Ok(Some(u)) => {
                let v = info(&u);
                *app.state::<UpdState>().pending.lock().unwrap() = Some((i, u));
                return Ok(v);
            }
            Ok(None) => {
                *app.state::<UpdState>().pending.lock().unwrap() = None;
                return Ok(json!({ "available": false, "current": app.package_info().version.to_string() }));
            }
            Err(e) => {
                eprintln!("update check via {ep} failed: {e}");
                last_err = e;
            }
        }
    }
    Err(last_err)
}

fn progress(app: &AppHandle, v: Value) {
    let _ = app.emit_to("main", "update-progress", v);
}

/// Download from one host, watching for stalls / very slow transfers.
async fn download_watched(app: &AppHandle, u: &Update, src: usize, last: bool) -> Result<Vec<u8>, String> {
    let got = Arc::new(AtomicU64::new(0));
    let total = Arc::new(AtomicU64::new(0));
    let start = Instant::now();
    let last_chunk = Arc::new(Mutex::new(Instant::now()));
    let (g, t, lc, h) = (got.clone(), total.clone(), last_chunk.clone(), app.clone());
    let mut emitted = Instant::now() - Duration::from_secs(1);
    progress(app, json!({ "phase": "download", "got": 0, "total": 0, "src": src }));
    let dl = u.download(
        move |n, len| {
            let now_got = g.fetch_add(n as u64, Ordering::Relaxed) + n as u64;
            if let Some(len) = len {
                t.store(len, Ordering::Relaxed);
            }
            *lc.lock().unwrap() = Instant::now();
            if emitted.elapsed() >= Duration::from_millis(120) {
                emitted = Instant::now();
                progress(&h, json!({ "phase": "download", "got": now_got, "total": len.unwrap_or(0), "src": src }));
            }
        },
        || {},
    );
    tokio::pin!(dl);
    let mut tick = tokio::time::interval(Duration::from_secs(2));
    loop {
        tokio::select! {
            r = &mut dl => return r.map_err(|e| e.to_string()),
            _ = tick.tick() => {
                let idle = last_chunk.lock().unwrap().elapsed();
                if idle > if last { STALL_LAST } else { STALL } {
                    return Err(format!("download stalled ({}s without data)", idle.as_secs()));
                }
                let (gb, tb, el) = (got.load(Ordering::Relaxed), total.load(Ordering::Relaxed), start.elapsed());
                if !last && el > SLOW_GRACE && tb > 0 && gb < tb {
                    let projected = el.as_secs_f64() * tb as f64 / gb.max(1) as f64;
                    if projected > SLOW_LIMIT.as_secs_f64() {
                        return Err(format!("download too slow ({gb}/{tb} bytes after {}s)", el.as_secs()));
                    }
                }
            }
        }
    }
}

/// Only ever called after the user clicked "Update now". Downloads (with host fallback), verifies
/// the signature, then installs and relaunches.
#[tauri::command]
pub async fn update_install(app: AppHandle) -> Result<String, String> {
    let st = app.state::<UpdState>();
    if st.busy.swap(true, Ordering::SeqCst) {
        return Err("busy".into());
    }
    let r = install_inner(&app).await;
    app.state::<UpdState>().busy.store(false, Ordering::SeqCst);
    if let Err(e) = &r {
        eprintln!("update failed: {e}");
        progress(&app, json!({ "phase": "error", "error": e }));
    }
    r
}

async fn install_inner(app: &AppHandle) -> Result<String, String> {
    let first = app.state::<UpdState>().pending.lock().unwrap().clone();
    let Some((i0, u0)) = first else { return Err("no pending update".into()) };
    let eps = endpoints(app);
    // the host that announced the update first, then the others in config order
    let order: Vec<usize> = std::iter::once(i0).chain((0..eps.len()).filter(|j| *j != i0)).collect();
    let mut last_err = String::new();
    for (k, &j) in order.iter().enumerate() {
        let u = if j == i0 {
            u0.clone()
        } else {
            match check_one(app, &eps[j]).await {
                Ok(Some(u)) if u.version == u0.version => u,
                Ok(_) => continue, // that host doesn't have this version (yet)
                Err(e) => {
                    eprintln!("update fallback check via {} failed: {e}", eps[j]);
                    continue;
                }
            }
        };
        let is_last = k + 1 == order.len();
        match download_watched(app, &u, k, is_last).await {
            Ok(bytes) => {
                // signature already verified inside `download`
                progress(app, json!({ "phase": "install", "version": u.version, "bytes": bytes.len() }));
                if dry_run() {
                    eprintln!("LR_UPDATE_DRYRUN: downloaded + verified {} bytes from {}", bytes.len(), u.download_url);
                    return Ok(format!("dry-run:{}", bytes.len()));
                }
                crate::mark_updated(app, &u.version);
                // Windows: launches the passive NSIS installer and exits; it relaunches LucidRank.
                u.install(bytes).map_err(|e| e.to_string())?;
                app.restart();
            }
            Err(e) => {
                eprintln!("update download from {} failed: {e}", u.download_url);
                last_err = e;
            }
        }
    }
    Err(if last_err.is_empty() { "no host had the update".into() } else { last_err })
}
