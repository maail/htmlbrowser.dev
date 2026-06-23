mod commands;
mod menu;
mod paths;
mod protocol;
mod state;
mod storage;
mod watcher;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = state::new_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(app_state)
        .register_uri_scheme_protocol(protocol::SCHEME, |ctx, req| protocol::handle(ctx, req))
        .invoke_handler(tauri::generate_handler![
            commands::workspace::get_startup_state,
            commands::workspace::open_workspace,
            commands::workspace::push_recent_workspace,
            commands::workspace::remove_recent_workspace,
            commands::fs::read_directory,
            commands::fs::read_workspace_file,
            commands::fs::inspect_html,
            commands::settings::get_trust_mode,
            commands::settings::set_trust_mode,
            commands::preview::show_preview,
            commands::preview::update_preview_bounds,
            commands::search::search_workspace,
            commands::share::share_artifact,
            commands::share::get_share_status,
            commands::system::reveal_in_finder,
            commands::system::open_external,
        ])
        .setup(|app| {
            // Force the main window to show; on macOS the transparent +
            // sidebar effect can otherwise remain hidden until interaction.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
            }

            // Custom application menu with Check for Updates and Open Folder.
            let menu = menu::build(app.handle())?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            id if id == menu::ID_CHECK_UPDATES => {
                let _ = app.emit("menu:check-updates", ());
            }
            id if id == menu::ID_OPEN_FOLDER => {
                let _ = app.emit("menu:open-folder", ());
            }
            id if id == menu::ID_RELOAD_PREVIEW => {
                let _ = app.emit("menu:reload-preview", ());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
