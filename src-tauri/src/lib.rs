//! LucidRank desktop: tray app + local JSON storage + game-process detection.
//!
//! ANTI-CHEAT SAFETY (Vanguard / Tencent ACE / VAC):
//! The only "game awareness" in this app is reading the OS process list (process
//! *names* only, via `sysinfo`) every few seconds. We never open a handle to a game
//! process, never read or write its memory, never inject or hook, never draw over it,
//! never capture the screen, never send input. All windows are normal, separate windows.

use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    thread,
    time::Duration,
};

use serde::Deserialize;
use serde_json::{json, Value};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

const POLL_SECS: u64 = 5;
/// A "day" rolls over at 05:00 local time, so a 1 am session still counts as the same evening.
const DAY_ROLLOVER_HOURS: i64 = 5;

/// Process names we look for (lower-case). Name match only.
const GAMES: &[(&str, &[&str])] = &[
    ("val", &["valorant-win64-shipping.exe", "valorant-win64-shipping"]),
    ("cs2", &["cs2.exe", "cs2"]),
];

#[derive(Deserialize, Clone)]
struct Labels {
    open: String,
    checkin: String,
    lineups: String,
    quit: String,
    tooltip: String,
    notif_title: String,
    notif_body: String,
    tray_hint_title: String,
    tray_hint_body: String,
}

impl Default for Labels {
    fn default() -> Self {
        Labels {
            open: "Open LucidRank".into(),
            checkin: "Check in now".into(),
            lineups: "Lineups".into(),
            quit: "Quit".into(),
            tooltip: "LucidRank".into(),
            notif_title: "Game on. Quick check-in?".into(),
            notif_body: "8 taps, about 10 seconds.".into(),
            tray_hint_title: "LucidRank is still running".into(),
            tray_hint_body: "It sits in the tray. Right-click the icon to quit.".into(),
        }
    }
}

struct TrayItems {
    open: MenuItem<Wry>,
    checkin: MenuItem<Wry>,
    lineups: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

#[derive(Default)]
struct AppState {
    io: Mutex<()>,
    game: Mutex<Option<String>>,
    labels: Mutex<Labels>,
    tray: Mutex<Option<TrayItems>>,
    /// secondary windows whose page has booted and called `window_ready`
    ready: Mutex<std::collections::HashSet<String>>,
}

// ---------------------------------------------------------------- storage

fn data_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("LucidRank"));
    let _ = fs::create_dir_all(&dir);
    dir
}
fn data_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("lucidrank-data.json")
}
fn prompt_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("prompt-state.json")
}

fn read_json(path: &PathBuf) -> Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({}))
}

fn write_json(path: &PathBuf, v: &Value) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    let s = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    fs::write(&tmp, s).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn today_key() -> String {
    (chrono::Local::now() - chrono::Duration::hours(DAY_ROLLOVER_HOURS))
        .format("%Y-%m-%d")
        .to_string()
}

// ---------------------------------------------------------------- windows

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Result of opening a secondary window.
#[derive(Clone, Copy, PartialEq)]
enum Opened {
    Existing,
    Created,
}

fn focus_existing(app: &AppHandle, label: &str) -> bool {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return true;
    }
    false
}

// IMPORTANT (Windows / WebView2): never build a webview window on the main thread while it is
// handling a sync command, tray/menu event or run_on_main_thread closure: WebView2 creation then
// deadlocks (blank white window, event loop frozen so even the X button stops working).
// These two builders must only be called from an async command or a spawned thread
// (see `open_window` and `spawn_open`); `build()` then hands the work to the event loop and waits.
fn open_checkin(app: &AppHandle, auto: bool) -> Result<Opened, String> {
    if focus_existing(app, "checkin") {
        return Ok(Opened::Existing);
    }
    let title = app.state::<AppState>().labels.lock().unwrap().checkin.clone();
    let page = test_hook("checkin.html")?;
    WebviewWindowBuilder::new(app, "checkin", WebviewUrl::App(page.into()))
        .title(format!("LucidRank · {title}"))
        .inner_size(460.0, 700.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(true)
        .center()
        // A normal centered window, not an overlay. Kept on top only when it pops up by itself
        // (game start) so it doesn't get lost behind the launcher; focused once when it opens.
        .always_on_top(auto)
        // custom dark title bar (see checkin.html); native shadow keeps Win11 rounded corners
        .decorations(false)
        .shadow(true)
        .background_color(tauri::window::Color(12, 12, 15, 255))
        .focused(true)
        .build()
        .map(|_| Opened::Created)
        .map_err(|e| e.to_string())
}

fn open_lineups(app: &AppHandle) -> Result<Opened, String> {
    if focus_existing(app, "lineups") {
        return Ok(Opened::Existing);
    }
    let title = app.state::<AppState>().labels.lock().unwrap().lineups.clone();
    let page = test_hook("lineups.html")?;
    WebviewWindowBuilder::new(app, "lineups", WebviewUrl::App(page.into()))
        .title(format!("LucidRank · {title}"))
        .inner_size(1120.0, 760.0)
        .min_inner_size(860.0, 600.0)
        .center()
        .decorations(false)
        .shadow(true)
        .background_color(tauri::window::Color(10, 10, 12, 255))
        .focused(true)
        .build()
        .map(|_| Opened::Created)
        .map_err(|e| e.to_string())
}

/// Debug-only test hooks for the in-window fallback (never compiled into release builds):
/// LR_TEST_WINDOWS=fail  -> building the window returns an error
/// LR_TEST_WINDOWS=blank -> the window loads a page that never reports `window_ready`
///                          (simulates the blank white WebView2 window from v0.1.0)
#[cfg(debug_assertions)]
fn test_hook(page: &str) -> Result<String, String> {
    match std::env::var("LR_TEST_WINDOWS").as_deref() {
        Ok("fail") => Err("forced failure (LR_TEST_WINDOWS=fail)".into()),
        Ok("blank") => Ok("blank-test.html".into()),
        _ => Ok(page.into()),
    }
}
#[cfg(not(debug_assertions))]
fn test_hook(page: &str) -> Result<String, String> {
    Ok(page.into())
}

/// Open a window from contexts that run on the main thread (tray menu). Uses its own thread.
fn spawn_open(app: &AppHandle, kind: &'static str, auto: bool) {
    let h = app.clone();
    thread::spawn(move || {
        let r = match kind {
            "checkin" => open_checkin(&h, auto),
            "lineups" => open_lineups(&h),
            _ => Ok(Opened::Existing),
        };
        if let Err(e) = r {
            eprintln!("{kind} window: {e}");
            // fallback: run the check-in inside the main window
            if kind == "checkin" {
                show_main(&h);
                let _ = h.emit_to("main", "checkin-inline", json!({ "reason": e }));
            }
        }
    });
}

// ---------------------------------------------------------------- game watcher

fn watched(app: &AppHandle) -> Vec<&'static str> {
    let data = {
        let st = app.state::<AppState>();
        let _g = st.io.lock().unwrap();
        read_json(&data_file(app))
    };
    GAMES
        .iter()
        .map(|(id, _)| *id)
        .filter(|id| data["settings"]["watch"][*id].as_bool() != Some(false))
        .collect()
}

fn detect(sys: &mut System, watch: &[&str]) -> Option<String> {
    // Names only: ProcessRefreshKind::nothing() skips cpu/memory/exe/cmd/env queries.
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    for p in sys.processes().values() {
        let name = p.name().to_string_lossy().to_lowercase();
        for (id, names) in GAMES {
            if watch.contains(id) && names.iter().any(|n| *n == name) {
                return Some((*id).to_string());
            }
        }
    }
    None
}

/// Called when a watched game appears. At most one prompt per day.
fn maybe_prompt(app: &AppHandle, game: &str) {
    let today = today_key();
    let st = app.state::<AppState>();
    {
        let _g = st.io.lock().unwrap();
        let data = read_json(&data_file(app));
        if !data["checkins"][&today].is_null() {
            return; // already checked in today
        }
        let pf = prompt_file(app);
        let mut p = read_json(&pf);
        if p["promptedOn"].as_str() == Some(&today) || p["skipOn"].as_str() == Some(&today) {
            return; // already asked today, or "not today"
        }
        p["promptedOn"] = json!(today);
        p["promptedFor"] = json!(game);
        let _ = write_json(&pf, &p);
    }
    let labels = st.labels.lock().unwrap().clone();
    let _ = app
        .notification()
        .builder()
        .title(&labels.notif_title)
        .body(&labels.notif_body)
        .show();
    // the watcher already runs on its own thread, so building the window here is safe
    spawn_open(app, "checkin", true);
}

fn start_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut sys = System::new();
        let mut last: Option<String> = None;
        loop {
            let watch = watched(&app);
            let now = detect(&mut sys, &watch);
            if now != last {
                *app.state::<AppState>().game.lock().unwrap() = now.clone();
                let _ = app.emit("game-status", json!({ "game": now }));
                if let Some(g) = &now {
                    maybe_prompt(&app, g);
                }
                last = now;
            }
            thread::sleep(Duration::from_secs(POLL_SECS));
        }
    });
}

// ---------------------------------------------------------------- commands

#[tauri::command]
fn load_data(app: AppHandle, state: tauri::State<AppState>) -> Value {
    let _g = state.io.lock().unwrap();
    read_json(&data_file(&app))
}

#[tauri::command]
fn save_data(app: AppHandle, window: tauri::Window, state: tauri::State<AppState>, data: Value) -> Result<(), String> {
    {
        let _g = state.io.lock().unwrap();
        write_json(&data_file(&app), &data)?;
    }
    let _ = app.emit("data-changed", json!({ "from": window.label() }));
    Ok(())
}

#[tauri::command]
fn data_location(app: AppHandle) -> String {
    data_file(&app).to_string_lossy().to_string()
}

#[tauri::command]
fn delete_all_data(app: AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    {
        let _g = state.io.lock().unwrap();
        for f in [data_file(&app), prompt_file(&app)] {
            if f.exists() {
                fs::remove_file(&f).map_err(|e| e.to_string())?;
            }
        }
    }
    let _ = app.emit("data-changed", json!({ "from": "delete" }));
    Ok(())
}

#[tauri::command]
async fn export_data(app: AppHandle) -> Result<Option<String>, String> {
    let name = format!("lucidrank-export-{}.json", chrono::Local::now().format("%Y%m%d"));
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("JSON", &["json"])
        .blocking_save_file();
    let Some(fp) = picked else { return Ok(None) };
    let path = fp.into_path().map_err(|e| e.to_string())?;
    let data = {
        let st = app.state::<AppState>();
        let _g = st.io.lock().unwrap();
        read_json(&data_file(&app))
    };
    write_json(&path, &data)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// Lets the user pick a result screenshot. We only store the file path (OCR: not in v0.1).
#[tauri::command]
async fn pick_screenshot(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "bmp"])
        .blocking_pick_file()
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn game_status(state: tauri::State<AppState>) -> Option<String> {
    state.game.lock().unwrap().clone()
}

#[tauri::command]
fn skip_today(app: AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let _g = state.io.lock().unwrap();
    let pf = prompt_file(&app);
    let mut p = read_json(&pf);
    p["skipOn"] = json!(today_key());
    write_json(&pf, &p)
}

#[tauri::command]
async fn open_window(app: AppHandle, kind: String) -> Result<String, String> {
    // async => runs on a worker thread, never on the main thread (see note on open_checkin)
    let r = match kind.as_str() {
        "checkin" => open_checkin(&app, false),
        "lineups" => open_lineups(&app),
        _ => {
            show_main(&app);
            return Ok("existing".into());
        }
    }?;
    // "existing" only if that window's page really booted; otherwise the caller waits for
    // `window-ready` and falls back to the in-window view if it never comes.
    let ready = app.state::<AppState>().ready.lock().unwrap().contains(&kind);
    Ok(match (r, ready) {
        (Opened::Created, _) => "created",
        (Opened::Existing, true) => "existing",
        (Opened::Existing, false) => "pending",
    }
    .into())
}

/// A secondary window calls this once its page has loaded and booted, so the main window
/// knows the pop-up really works (otherwise it falls back to the in-window check-in).
#[tauri::command]
fn window_ready(app: AppHandle, window: tauri::WebviewWindow) {
    app.state::<AppState>().ready.lock().unwrap().insert(window.label().to_string());
    let _ = app.emit("window-ready", json!({ "label": window.label() }));
}

/// Close a secondary window by label (used by the main window's fallback).
#[tauri::command]
fn close_window(app: AppHandle, label: String) {
    if label != "main" {
        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.destroy();
        }
    }
}

/// Close the calling window (main only hides: the app keeps running in the tray).
#[tauri::command]
fn close_self(window: tauri::WebviewWindow) {
    if window.label() == "main" {
        let _ = window.hide();
    } else {
        let _ = window.close();
    }
}

/// Title-bar buttons of our custom (undecorated) windows. Returns the maximized state.
#[tauri::command]
fn win_action(window: tauri::WebviewWindow, action: String) -> bool {
    match action.as_str() {
        "min" => {
            let _ = window.minimize();
        }
        "max" => {
            if window.is_maximizable().unwrap_or(false) {
                if window.is_maximized().unwrap_or(false) {
                    let _ = window.unmaximize();
                } else {
                    let _ = window.maximize();
                }
            }
        }
        "close" => {
            // same as close_self: main hides to the tray, others close
            if window.label() == "main" {
                let _ = window.hide();
            } else {
                let _ = window.close();
            }
        }
        _ => {}
    }
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn win_state(window: tauri::WebviewWindow) -> bool {
    window.is_maximized().unwrap_or(false)
}

#[tauri::command]
fn set_labels(app: AppHandle, state: tauri::State<AppState>, labels: Labels) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(&labels.tooltip));
    }
    if let Some(t) = state.tray.lock().unwrap().as_ref() {
        let _ = t.open.set_text(&labels.open);
        let _ = t.checkin.set_text(&labels.checkin);
        let _ = t.lineups.set_text(&labels.lineups);
        let _ = t.quit.set_text(&labels.quit);
    }
    *state.labels.lock().unwrap() = labels;
}

#[tauri::command]
fn autostart_get(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn autostart_set(app: AppHandle, on: bool) -> Result<bool, String> {
    let al = app.autolaunch();
    if on { al.enable() } else { al.disable() }.map_err(|e| e.to_string())?;
    Ok(al.is_enabled().unwrap_or(on))
}

#[tauri::command]
fn app_info() -> Value {
    json!({ "version": env!("CARGO_PKG_VERSION"), "today": today_key(), "os": std::env::consts::OS })
}

// ---------------------------------------------------------------- tray

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let l = Labels::default();
    let open = MenuItem::with_id(app, "open", &l.open, true, None::<&str>)?;
    let checkin = MenuItem::with_id(app, "checkin", &l.checkin, true, None::<&str>)?;
    let lineups = MenuItem::with_id(app, "lineups", &l.lineups, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", &l.quit, true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &checkin, &lineups, &sep, &quit])?;

    let mut tb = TrayIconBuilder::with_id("main")
        .tooltip("LucidRank")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "open" => show_main(app),
            "checkin" => spawn_open(app, "checkin", false),
            "lineups" => spawn_open(app, "lineups", false),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tb = tb.icon(icon.clone());
    }
    tb.build(app)?;
    *app.state::<AppState>().tray.lock().unwrap() = Some(TrayItems { open, checkin, lineups, quit });
    Ok(())
}

// ---------------------------------------------------------------- run

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            data_location,
            delete_all_data,
            export_data,
            pick_screenshot,
            game_status,
            skip_today,
            open_window,
            close_self,
            win_action,
            window_ready,
            close_window,
            win_state,
            set_labels,
            autostart_get,
            autostart_set,
            app_info
        ])
        .setup(|app| {
            let h = app.handle().clone();
            build_tray(&h)?;
            let hidden = std::env::args().any(|a| a == "--autostart" || a == "--hidden");
            if !hidden {
                show_main(&h);
            }
            start_watcher(h);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                if let WindowEvent::Destroyed = event {
                    let app = window.app_handle();
                    app.state::<AppState>().ready.lock().unwrap().remove(window.label());
                }
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Closing the main window keeps LucidRank in the tray.
                api.prevent_close();
                let _ = window.hide();
                let app = window.app_handle();
                let st = app.state::<AppState>();
                let first = {
                    let _g = st.io.lock().unwrap();
                    let pf = prompt_file(app);
                    let mut p = read_json(&pf);
                    let first = p["trayHintShown"].as_bool() != Some(true);
                    if first {
                        p["trayHintShown"] = json!(true);
                        let _ = write_json(&pf, &p);
                    }
                    first
                };
                if first {
                    let l = st.labels.lock().unwrap().clone();
                    let _ = app.notification().builder().title(&l.tray_hint_title).body(&l.tray_hint_body).show();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building LucidRank");

    app.run(|_app, event| {
        // Keep running in the tray when every window is closed; only "Quit" exits.
        if let RunEvent::ExitRequested { code: None, api, .. } = event {
            api.prevent_exit();
        }
    });
}
