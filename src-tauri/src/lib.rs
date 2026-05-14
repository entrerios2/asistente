use serde::Serialize;
use std::sync::Mutex;
use tauri::{State, Manager};
use cpal::traits::{DeviceTrait, HostTrait};

#[derive(Serialize, Clone)]
pub struct AudioDevice {
    id: String,
    name: String,
    backend: String,
    direction: String,
}

pub struct AudioState {
    pub selected_input: Mutex<Option<String>>,
    pub selected_output: Mutex<Option<String>>,
}

#[tauri::command]
fn list_audio_devices() -> Vec<AudioDevice> {
    let mut devices = Vec::new();
    let hosts = cpal::available_hosts();

    for host_id in hosts {
        let host = cpal::host_from_id(host_id).unwrap();
        let backend = host_id.name().to_string();

        // Dispositivos de entrada
        if let Ok(input_devices) = host.input_devices() {
            for device in input_devices {
                if let Ok(name) = device.name() {
                    devices.push(AudioDevice {
                        id: name.clone(),
                        name,
                        backend: backend.clone(),
                        direction: "input".to_string(),
                    });
                }
            }
        }

        // Dispositivos de salida
        if let Ok(output_devices) = host.output_devices() {
            for device in output_devices {
                if let Ok(name) = device.name() {
                    devices.push(AudioDevice {
                        id: name.clone(),
                        name,
                        backend: backend.clone(),
                        direction: "output".to_string(),
                    });
                }
            }
        }
    }
    devices
}

#[tauri::command]
fn select_audio_device(state: State<'_, AudioState>, id: String, direction: String) {
    if direction == "input" {
        let mut input = state.selected_input.lock().unwrap();
        *input = Some(id);
    } else {
        let mut output = state.selected_output.lock().unwrap();
        *output = Some(id);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AudioState {
        selected_input: Mutex::new(None),
        selected_output: Mutex::new(None),
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![list_audio_devices, select_audio_device])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
