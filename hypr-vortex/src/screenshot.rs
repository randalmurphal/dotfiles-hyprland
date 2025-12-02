//! Screenshot capture using grim (for now).
//!
//! Future: implement wlr-screencopy protocol directly for GPU-GPU transfer.

use std::process::Command;

use anyhow::{Context, Result};
use tracing::debug;

use crate::animation::WindowGeometry;

/// Capture a screenshot of the specified region.
/// Returns RGBA pixel data.
pub fn capture_region(geometry: &WindowGeometry) -> Result<Vec<u8>> {
    let region = format!(
        "{},{} {}x{}",
        geometry.x, geometry.y, geometry.width, geometry.height
    );

    debug!("Capturing region: {}", region);

    // Use grim with raw output (pixman format)
    // -t ppm gives us raw RGB data we can parse
    let output = Command::new("grim")
        .args(["-g", &region, "-t", "ppm", "-"])
        .output()
        .context("Failed to run grim")?;

    if !output.status.success() {
        anyhow::bail!(
            "grim failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    // Parse PPM format (P6 header + raw RGB)
    let data = output.stdout;
    parse_ppm_to_rgba(&data, geometry.width as usize, geometry.height as usize)
}

/// Parse PPM (P6) format to RGBA.
fn parse_ppm_to_rgba(data: &[u8], width: usize, height: usize) -> Result<Vec<u8>> {
    // PPM P6 format:
    // P6\n
    // width height\n
    // maxval\n
    // <raw RGB data>

    let mut i = 0;

    // Skip "P6\n"
    while i < data.len() && data[i] != b'\n' {
        i += 1;
    }
    i += 1;

    // Skip comments
    while i < data.len() && data[i] == b'#' {
        while i < data.len() && data[i] != b'\n' {
            i += 1;
        }
        i += 1;
    }

    // Skip "width height\n"
    while i < data.len() && data[i] != b'\n' {
        i += 1;
    }
    i += 1;

    // Skip "maxval\n"
    while i < data.len() && data[i] != b'\n' {
        i += 1;
    }
    i += 1;

    // Rest is raw RGB data
    let rgb_data = &data[i..];
    let expected_size = width * height * 3;

    if rgb_data.len() < expected_size {
        anyhow::bail!(
            "PPM data too short: {} < {}",
            rgb_data.len(),
            expected_size
        );
    }

    // Convert RGB to RGBA
    let mut rgba = Vec::with_capacity(width * height * 4);
    for pixel in rgb_data[..expected_size].chunks(3) {
        rgba.push(pixel[0]); // R
        rgba.push(pixel[1]); // G
        rgba.push(pixel[2]); // B
        rgba.push(255);      // A (opaque)
    }

    debug!("Captured {}x{} = {} bytes RGBA", width, height, rgba.len());
    Ok(rgba)
}

/// Capture using PNG (slower but more reliable fallback).
pub fn capture_region_png(geometry: &WindowGeometry) -> Result<Vec<u8>> {
    let tmp_path = format!("/tmp/vortex-{}.png", std::process::id());
    let region = format!(
        "{},{} {}x{}",
        geometry.x, geometry.y, geometry.width, geometry.height
    );

    let status = Command::new("grim")
        .args(["-g", &region, &tmp_path])
        .status()
        .context("Failed to run grim")?;

    if !status.success() {
        anyhow::bail!("grim failed");
    }

    // Load PNG and convert to RGBA
    let img = image::open(&tmp_path).context("Failed to open screenshot")?;
    let rgba = img.to_rgba8();

    // Cleanup
    let _ = std::fs::remove_file(&tmp_path);

    Ok(rgba.into_raw())
}
