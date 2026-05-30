mod katago_bridge;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            katago_bridge::katago_setup_status,
            katago_bridge::install_katago_runtime
        ])
        .setup(|_app| {
            katago_bridge::start_bridge_server();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
