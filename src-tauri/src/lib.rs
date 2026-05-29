mod katago_bridge;

pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            katago_bridge::start_bridge_server();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
