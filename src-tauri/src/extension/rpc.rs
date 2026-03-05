use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use anyhow::Result;

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    pub params: serde_json::Value,
    pub id: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<serde_json::Value>,
    pub id: Option<serde_json::Value>,
}

pub async fn handle_request(
    app_handle: &AppHandle,
    extension_id: &str,
    request: JsonRpcRequest,
    permissions: &[String],
) -> Result<serde_json::Value, serde_json::Value> {
    // Check permissions strictly
    let has_permission = match request.method.as_str() {
        "codelane.ping" => true,
        
        "codelane.terminal.subscribe" | "codelane.terminal.list" => {
            permissions.contains(&"terminal".to_string()) || 
            permissions.contains(&"terminal:read".to_string())
        }
        
        "codelane.terminal.write" => {
            permissions.contains(&"terminal".to_string()) || 
            permissions.contains(&"terminal:write".to_string())
        }
        
        "codelane.terminal.create" | "codelane.terminal.close" => {
            permissions.contains(&"terminal".to_string()) || 
            permissions.contains(&"terminal:control".to_string())
        }
        
        "codelane.lane.list" | "codelane.agent.getStatus" | "codelane.agent.getTerminal" => {
            permissions.contains(&"lanes".to_string()) || 
            permissions.contains(&"lanes:read".to_string()) ||
            permissions.contains(&"agent:read".to_string())
        }
        
        "codelane.notification.show" => {
            permissions.contains(&"notification".to_string())
        }
        
        _ => false,
    };

    if !has_permission {
        tracing::warn!("[Extension {}] Permission denied for method {}", extension_id, request.method);
        return Err(serde_json::json!(format!("Permission denied for method {}", request.method)));
    }

    match request.method.as_str() {
        "codelane.ping" => Ok(serde_json::json!("pong")),
        "codelane.terminal.subscribe" => {
            if let Some(term_id) = request.params.get("id").and_then(|v| v.as_str()) {
                let extension_state = app_handle.state::<crate::extension::ExtensionState>();
                let topic = format!("terminal.output.{}", term_id);
                extension_state.subscribe(extension_id.to_string(), topic).await;
                Ok(serde_json::json!(null))
            } else {
                Err(serde_json::json!("Missing terminal id"))
            }
        }
        "codelane.agent.getTerminal" => {
            if let Some(lane_id) = request.params.get("laneId").and_then(|v| v.as_str()) {
                let terminal_state = app_handle.state::<crate::terminal::TerminalState>();
                match crate::terminal::get_terminal_id_by_lane(terminal_state, lane_id.to_string()).await {
                    Ok(id) => Ok(serde_json::json!(id)),
                    Err(e) => Err(serde_json::json!(e)),
                }
            } else {
                Err(serde_json::json!("Missing laneId"))
            }
        }
        "codelane.agent.getStatus" => {
            if let Some(lane_id) = request.params.get("laneId").and_then(|v| v.as_str()) {
                let lane_state = app_handle.state::<crate::lane::LaneState>();
                match crate::lane::lane_get(lane_id.to_string(), lane_state) {
                    Ok(lane) => Ok(serde_json::json!(lane)),
                    Err(e) => Err(serde_json::json!(e)),
                }
            } else {
                Err(serde_json::json!("Missing laneId"))
            }
        }
        "codelane.notification.show" => {
            if let (Some(title), Some(body)) = (
                request.params.get("title").and_then(|v| v.as_str()),
                request.params.get("body").and_then(|v| v.as_str())
            ) {
                use tauri_plugin_notification::NotificationExt;
                app_handle.notification()
                    .builder()
                    .title(title)
                    .body(body)
                    .show()
                    .map_err(|e| serde_json::json!(e.to_string()))
                    .map(|_| serde_json::json!(null))
            } else {
                Err(serde_json::json!("Missing title or body"))
            }
        }
        "codelane.terminal.write" => {
            if let (Some(term_id), Some(data)) = (
                request.params.get("id").and_then(|v| v.as_str()),
                request.params.get("data").and_then(|v| v.as_str())
            ) {
                let terminal_state = app_handle.state::<crate::terminal::TerminalState>();
                match crate::terminal::write_terminal(terminal_state, term_id.to_string(), data.to_string()).await {
                    Ok(_) => Ok(serde_json::json!(null)),
                    Err(e) => Err(serde_json::json!(e)),
                }
            } else {
                Err(serde_json::json!("Invalid parameters"))
            }
        }
        "codelane.terminal.list" => {
            let terminal_state = app_handle.state::<crate::terminal::TerminalState>();
            match crate::terminal::list_terminals(terminal_state).await {
                Ok(list) => Ok(serde_json::json!(list)),
                Err(e) => Err(serde_json::json!(e)),
            }
        }
        "codelane.terminal.create" => {
            let terminal_state = app_handle.state::<crate::terminal::TerminalState>();
            match crate::terminal::create_terminal(
                app_handle.clone(),
                terminal_state,
                request.params.get("shell").and_then(|v| v.as_str()).map(|s| s.to_string()),
                request.params.get("args").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()),
                request.params.get("cwd").and_then(|v| v.as_str()).map(|s| s.to_string()),
                None, // env
            ).await {
                Ok(id) => Ok(serde_json::json!(id)),
                Err(e) => Err(serde_json::json!(e)),
            }
        }
        "codelane.terminal.close" => {
            if let Some(term_id) = request.params.get("id").and_then(|v| v.as_str()) {
                let terminal_state = app_handle.state::<crate::terminal::TerminalState>();
                match crate::terminal::close_terminal(
                    app_handle.clone(),
                    terminal_state,
                    term_id.to_string(),
                ).await {
                    Ok(_) => Ok(serde_json::json!(null)),
                    Err(e) => Err(serde_json::json!(e)),
                }
            } else {
                Err(serde_json::json!("Missing terminal id"))
            }
        }
        "codelane.lane.list" => {
            let lane_state = app_handle.state::<crate::lane::LaneState>();
            match crate::lane::lane_list(lane_state) {
                Ok(list) => Ok(serde_json::json!(list)),
                Err(e) => Err(serde_json::json!(e)),
            }
        }
        _ => Err(serde_json::json!("Method not found")),
    }
}
