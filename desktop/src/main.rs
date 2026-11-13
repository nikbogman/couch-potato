#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{webview::PageLoadEvent, Manager};

// A window around the deployed app: deploys reach the TV as they do in a browser. The app finds `__TAURI__`
// and makes this window fullscreen itself, which (unlike the browser's fullscreen) needs no press on the TV.
fn main() {
    tauri::Builder::default()
        // The splash (local, instant) shows while the hidden main window loads the app; then they swap, with no blank flash.
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && payload.event() == PageLoadEvent::Finished {
                let _ = webview.window().show();
                let _ = webview.window().set_focus();
                if let Some(splash) = webview.app_handle().get_webview_window("splash") {
                    let _ = splash.close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("couch potato failed to start");
}
