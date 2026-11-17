pub mod db;

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn set_mac_dock_icon_data(bytes: *const u8, length: usize);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .invoke_handler(tauri::generate_handler![
      db::test_connection,
      db::get_database_objects,
      db::execute_query
    ])
    .setup(|_app| {
      #[cfg(target_os = "macos")]
      {
        const ICON_BYTES: &[u8] = include_bytes!("../icons/icon.png");
        unsafe {
          set_mac_dock_icon_data(ICON_BYTES.as_ptr(), ICON_BYTES.len());
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
