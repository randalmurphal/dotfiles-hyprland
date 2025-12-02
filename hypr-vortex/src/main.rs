//! Hypr-Vortex: Extensible window close animations for Hyprland
//!
//! Architecture:
//! 1. Daemon runs in background, pre-warmed and ready
//! 2. Close script (Super+Q) sends window geometry via Unix socket
//! 3. Daemon captures screenshot of window region
//! 4. Daemon signals script to actually close the window
//! 5. Daemon displays layer-shell overlay with animated effect
//!
//! Available animations: vortex, shrink, fade
//! Default: vortex (black hole sucking effect)

mod animation;
mod animations;
mod overlay;
mod screenshot;

use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result};
use tracing::{debug, error, info, warn};

use animation::{AnimationRegistry, WindowGeometry};

const SOCKET_PATH: &str = "/tmp/hypr-vortex.sock";

fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "hypr_vortex=info".to_string()),
        )
        .init();

    info!("Starting hypr-vortex daemon v0.2");

    // Set up animation registry
    let mut registry = AnimationRegistry::new();
    animations::register_all(&mut registry);

    // Check for animation override from env
    if let Ok(anim_name) = std::env::var("VORTEX_ANIMATION") {
        if registry.get(&anim_name).is_some() {
            info!("Using animation from env: {}", anim_name);
            registry.set_default(Box::leak(anim_name.into_boxed_str()));
        } else {
            warn!("Unknown animation '{}', using default", anim_name);
        }
    }

    info!(
        "Available animations: {:?}",
        registry.list()
    );

    let registry = Arc::new(registry);

    // Remove old socket
    let _ = std::fs::remove_file(SOCKET_PATH);

    // Bind socket
    let listener = UnixListener::bind(SOCKET_PATH).context("Failed to create socket")?;

    info!("Listening on {}", SOCKET_PATH);
    info!("Ready for window close events");

    // Accept connections
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let registry = Arc::clone(&registry);
                // Handle each connection in a thread for responsiveness
                thread::spawn(move || {
                    if let Err(e) = handle_connection(stream, &registry) {
                        error!("Connection error: {}", e);
                    }
                });
            }
            Err(e) => error!("Accept error: {}", e),
        }
    }

    Ok(())
}

fn handle_connection(mut stream: UnixStream, registry: &AnimationRegistry) -> Result<()> {
    // Set read timeout to prevent blocking forever
    stream.set_read_timeout(Some(Duration::from_secs(5)))?;

    let mut reader = BufReader::new(stream.try_clone()?);
    let mut line = String::new();
    reader.read_line(&mut line)?;

    // Parse: "x,y,width,height,address" or "x,y,width,height,address,animation"
    let parts: Vec<&str> = line.trim().split(',').collect();
    if parts.len() < 5 {
        anyhow::bail!("Invalid format: expected 'x,y,width,height,address[,animation]', got: {}", line);
    }

    let geometry = WindowGeometry {
        x: parts[0].parse().context("invalid x")?,
        y: parts[1].parse().context("invalid y")?,
        width: parts[2].parse().context("invalid width")?,
        height: parts[3].parse().context("invalid height")?,
    };

    let window_address = parts[4].to_string();

    // Optional animation name
    let animation = if parts.len() > 5 {
        let name = parts[5];
        registry.get(name).unwrap_or_else(|| {
            warn!("Unknown animation '{}', using default", name);
            registry.default_animation()
        })
    } else {
        registry.default_animation()
    };

    info!(
        "Window close: ({}, {}) {}x{} using '{}'",
        geometry.x, geometry.y, geometry.width, geometry.height, animation.name()
    );

    // Validate geometry
    if geometry.width == 0 || geometry.height == 0 {
        anyhow::bail!("Invalid geometry: zero dimension");
    }
    if geometry.width > 8192 || geometry.height > 8192 {
        anyhow::bail!("Invalid geometry: too large");
    }

    // 1. Capture screenshot BEFORE closing window
    let screenshot_data = screenshot::capture_region(&geometry).or_else(|e| {
        warn!("Fast capture failed ({}), trying PNG fallback", e);
        screenshot::capture_region_png(&geometry)
    })?;

    debug!("Screenshot captured: {} bytes", screenshot_data.len());

    // 2. Make window invisible but keep it in tiling layout
    // Using alpha 0 keeps the window in place (siblings don't resize) but invisible
    let _ = std::process::Command::new("hyprctl")
        .args(["setprop", &format!("address:{}", window_address), "alpha", "0"])
        .output();

    // 3. Signal client that we're ready (they don't need to do anything)
    stream.write_all(b"CLOSE\n")?;
    stream.flush()?;

    // Small delay for opacity change to apply
    thread::sleep(Duration::from_millis(16));

    // 4. Run the animation overlay FIRST
    if let Err(e) = overlay::run_overlay(geometry, screenshot_data, animation) {
        error!("Overlay error: {}", e);
    }

    // 5. NOW close the window after animation completes
    info!("Animation done, closing window {}", window_address);
    let _ = std::process::Command::new("hyprctl")
        .args(["dispatch", &format!("closewindow address:{}", window_address)])
        .output();

    Ok(())
}
