//! Layer-shell overlay for rendering animations.
//!
//! Creates a Wayland layer-shell surface positioned over the closing window,
//! then renders the animation using wgpu.

use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result};
use smithay_client_toolkit::{
    compositor::{CompositorHandler, CompositorState},
    delegate_compositor, delegate_layer, delegate_output, delegate_registry, delegate_shm,
    output::{OutputHandler, OutputState},
    registry::{ProvidesRegistryState, RegistryState},
    registry_handlers,
    shell::{
        wlr_layer::{
            Anchor, KeyboardInteractivity, Layer, LayerShell, LayerShellHandler, LayerSurface,
            LayerSurfaceConfigure,
        },
        WaylandSurface,
    },
    shm::{slot::SlotPool, Shm, ShmHandler},
};
use rayon::prelude::*;
use tracing::{debug, info, warn};
use wayland_client::{
    globals::registry_queue_init,
    protocol::{wl_output, wl_shm, wl_surface},
    Connection, QueueHandle,
};

use crate::animation::{Animation, WindowGeometry};

/// Overlay state for Wayland event handling.
struct OverlayState {
    registry_state: RegistryState,
    compositor_state: CompositorState,
    output_state: OutputState,
    shm_state: Shm,
    layer_shell: LayerShell,

    /// The layer surface for our overlay
    layer_surface: Option<LayerSurface>,

    /// SHM buffer pool for software rendering fallback
    pool: Option<SlotPool>,

    /// Animation parameters
    geometry: WindowGeometry,
    animation: Arc<dyn Animation>,
    screenshot_data: Vec<u8>,

    /// Configured surface size (from compositor)
    surface_width: u32,
    surface_height: u32,

    /// Animation timing
    start_time: Instant,
    configured: bool,
    done: bool,
}

impl OverlayState {
    fn draw(&mut self, qh: &QueueHandle<Self>) {
        let Some(ref layer_surface) = self.layer_surface else {
            debug!("No layer surface");
            return;
        };

        // Use configured surface size
        let width = self.surface_width as i32;
        let height = self.surface_height as i32;
        if width == 0 || height == 0 {
            debug!("Surface not configured yet");
            return;
        }
        let stride = width * 4;

        // Calculate animation progress
        let elapsed = self.start_time.elapsed().as_secs_f32();
        let duration = self.animation.duration_ms() as f32 / 1000.0;
        let raw_progress = (elapsed / duration).min(1.0);
        let progress = self.animation.ease(raw_progress);

        debug!("Drawing frame: progress={:.2}, elapsed={:.3}s", progress, elapsed);

        // Check if animation complete
        if raw_progress >= 1.0 {
            info!("Animation complete");
            self.done = true;
            return;
        }

        // Get buffer from pool
        let pool = self.pool.as_mut().expect("pool must exist");
        let (buffer, canvas) = pool
            .create_buffer(
                width,
                height,
                stride,
                wl_shm::Format::Argb8888,
            )
            .expect("create buffer");

        // CPU-side vortex rendering
        let render_start = std::time::Instant::now();

        // Clear canvas to transparent
        canvas.fill(0);

        let win_w = self.geometry.width as usize;
        let win_h = self.geometry.height as usize;
        let surf_w = width as usize;
        let surf_h = height as usize;

        // Calculate offset within surface based on window position
        // For multi-monitor: window coords are global, use rem_euclid to handle negative coords
        // (left monitor has negative x values)
        let offset_x = (self.geometry.x).rem_euclid(surf_w as i32) as usize;
        let offset_y = (self.geometry.y).rem_euclid(surf_h as i32) as usize;

        // Render vortex effect at the correct offset
        render_cpu_vortex(
            canvas,
            &self.screenshot_data,
            win_w,
            win_h,
            surf_w,
            surf_h,
            offset_x,
            offset_y,
            progress,
        );

        debug!("Drew vortex at ({},{}) {}x{} in {}x{} surface, progress={:.2}",
               offset_x, offset_y, win_w, win_h, surf_w, surf_h, progress);
        debug!("Render took {:?}", render_start.elapsed());

        // Attach and commit
        let surface = layer_surface.wl_surface();
        surface.attach(Some(buffer.wl_buffer()), 0, 0);
        surface.damage_buffer(0, 0, width, height);
        surface.commit();

        // Request next frame
        surface.frame(qh, surface.clone());
    }
}

/// CPU rendering for vortex effect using rayon for parallelization.
/// Spaghettification: content stretches into thin strands that spiral into the black hole.
fn render_cpu_vortex(
    canvas: &mut [u8],
    screenshot_data: &[u8],
    win_w: usize,
    win_h: usize,
    surf_w: usize,
    _surf_h: usize,
    offset_x: usize,
    offset_y: usize,
    progress: f32,
) {
    let center_x = 0.5f32;
    let center_y = 0.5f32;
    let tau = std::f32::consts::TAU;

    // The singularity - black void at center
    let singularity_radius = 0.03 + progress * 0.02;

    // x^4 acceleration - slow start, fast end
    let accel = progress.powi(4);

    // Process rows in parallel
    canvas
        .par_chunks_mut(surf_w * 4)
        .enumerate()
        .for_each(|(surf_y, row)| {
            if surf_y < offset_y || surf_y >= offset_y + win_h {
                return;
            }
            let y = surf_y - offset_y;
            let v = y as f32 / win_h as f32;
            let dy = v - center_y;

            let x_end = (offset_x + win_w).min(surf_w);
            for surf_x in offset_x..x_end {
                let x = surf_x - offset_x;
                let u = x as f32 / win_w as f32;
                let dx = u - center_x;

                let dist = (dx * dx + dy * dy).sqrt();
                let angle = dy.atan2(dx);
                let dst_idx = surf_x * 4;

                // Inside the singularity = SOLID BLACK
                if dist < singularity_radius {
                    row[dst_idx] = 0;
                    row[dst_idx + 1] = 0;
                    row[dst_idx + 2] = 0;
                    row[dst_idx + 3] = 255;
                    continue;
                }

                // Accretion disk - many thin wispy light strands
                let disk_outer = singularity_radius + 0.06;
                if dist < disk_outer && dist > singularity_radius {
                    let num_strands = 32;
                    let rotation = accel * tau * 3.0;

                    let mut total_intensity = 0.0f32;

                    for i in 0..num_strands {
                        // Pseudo-random per strand (deterministic based on index)
                        let seed = i as f32 * 7.31;
                        let rand1 = (seed.sin() * 43758.5453).fract();
                        let rand2 = ((seed + 1.0).cos() * 22578.1459).fract();
                        let rand3 = ((seed * 2.3).sin() * 19283.2918).fract();

                        // Variable properties per strand
                        let strand_brightness = 0.3 + rand1 * 0.7; // 0.3 to 1.0
                        let strand_length = 0.02 + rand2 * 0.04; // How far it extends
                        let strand_width = 0.008 + rand3 * 0.015; // Very thin
                        let spiral_tight = 12.0 + rand1 * 8.0; // 12-20, tight spirals

                        let strand_base = (i as f32 / num_strands as f32) * tau;
                        let expected_angle = strand_base + spiral_tight * dist + rotation;

                        let mut angle_diff = (angle - expected_angle).rem_euclid(tau);
                        if angle_diff > tau / 2.0 {
                            angle_diff = tau - angle_diff;
                        }

                        // Only render if within this strand's length
                        let strand_start = singularity_radius;
                        let strand_end = singularity_radius + strand_length;
                        if dist > strand_start && dist < strand_end && angle_diff < strand_width {
                            let core = 1.0 - (angle_diff / strand_width);
                            // Fade at the outer tip
                            let tip_fade = 1.0 - ((dist - strand_start) / strand_length).powf(2.0);
                            let intensity = core.powf(2.0) * tip_fade * strand_brightness;
                            total_intensity += intensity;
                        }
                    }

                    if total_intensity > 0.01 {
                        let i = total_intensity.min(1.0);
                        // Purple with brightness variation
                        let r = (90.0 + 90.0 * i) * i;
                        let g = (20.0 + 35.0 * i) * i;
                        let b = (150.0 + 70.0 * i) * i;

                        row[dst_idx] = b.min(255.0) as u8;
                        row[dst_idx + 1] = g.min(255.0) as u8;
                        row[dst_idx + 2] = r.min(255.0) as u8;
                        row[dst_idx + 3] = 255;
                        continue;
                    }
                }

                // === SPIRAL SPAGHETTIFICATION ===
                // The key: stretch ALONG the spiral (tangentially), compress ACROSS it (radially)
                // This creates thin strands that wind around the center

                // How much to wind around - more rotations as we approach center
                // and as animation progresses
                let spiral_tightness = 1.0 / (dist + 0.05);
                let total_rotation = accel * spiral_tightness * 3.0 * tau;

                // Tangential stretch: sample from positions that are "behind" on the spiral
                // This elongates content along the spiral path
                let tangential_stretch = accel * spiral_tightness * 0.4;

                // Radial compression: as things stretch tangentially, they thin radially
                // Sample from further out = content compressing inward
                let radial_compression = 1.0 + accel * spiral_tightness * 2.0;

                // Calculate where to sample from
                // Unwind the spiral: go backwards along the spiral path
                let sample_angle = angle - total_rotation - tangential_stretch;
                let sample_dist = dist * radial_compression;

                let sample_u = center_x + sample_angle.cos() * sample_dist;
                let sample_v = center_y + sample_angle.sin() * sample_dist;

                // Outside bounds = that strand has been consumed
                if sample_u < 0.0 || sample_u > 1.0 || sample_v < 0.0 || sample_v > 1.0 {
                    row[dst_idx] = 0;
                    row[dst_idx + 1] = 0;
                    row[dst_idx + 2] = 0;
                    row[dst_idx + 3] = 0;
                    continue;
                }

                let src_x = (sample_u * win_w as f32) as usize;
                let src_y = (sample_v * win_h as f32) as usize;
                let src_idx = (src_y * win_w + src_x) * 4;

                if src_idx + 3 < screenshot_data.len() && dst_idx + 3 < row.len() {
                    let r = screenshot_data[src_idx];
                    let g = screenshot_data[src_idx + 1];
                    let b = screenshot_data[src_idx + 2];

                    // Darken as it approaches the hole
                    let near_hole = (0.2 - dist).max(0.0) / 0.2;
                    let darkness = 1.0 - near_hole * 0.5;

                    row[dst_idx] = (b as f32 * darkness) as u8;
                    row[dst_idx + 1] = (g as f32 * darkness) as u8;
                    row[dst_idx + 2] = (r as f32 * darkness) as u8;
                    row[dst_idx + 3] = 255;
                } else {
                    row[dst_idx] = 0;
                    row[dst_idx + 1] = 0;
                    row[dst_idx + 2] = 0;
                    row[dst_idx + 3] = 0;
                }
            }
        });
}

// Implement required SCTK traits

impl CompositorHandler for OverlayState {
    fn scale_factor_changed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wl_surface::WlSurface,
        _new_factor: i32,
    ) {
    }

    fn transform_changed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wl_surface::WlSurface,
        _new_transform: wl_output::Transform,
    ) {
    }

    fn frame(
        &mut self,
        _conn: &Connection,
        qh: &QueueHandle<Self>,
        _surface: &wl_surface::WlSurface,
        _time: u32,
    ) {
        if !self.done {
            self.draw(qh);
        }
    }

    fn surface_enter(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wl_surface::WlSurface,
        _output: &wl_output::WlOutput,
    ) {
    }

    fn surface_leave(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wl_surface::WlSurface,
        _output: &wl_output::WlOutput,
    ) {
    }
}

impl OutputHandler for OverlayState {
    fn output_state(&mut self) -> &mut OutputState {
        &mut self.output_state
    }

    fn new_output(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wl_output::WlOutput,
    ) {
    }

    fn update_output(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wl_output::WlOutput,
    ) {
    }

    fn output_destroyed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wl_output::WlOutput,
    ) {
    }
}

impl LayerShellHandler for OverlayState {
    fn closed(&mut self, _conn: &Connection, _qh: &QueueHandle<Self>, _layer: &LayerSurface) {
        self.done = true;
    }

    fn configure(
        &mut self,
        _conn: &Connection,
        qh: &QueueHandle<Self>,
        _layer: &LayerSurface,
        configure: LayerSurfaceConfigure,
        _serial: u32,
    ) {
        debug!("Layer surface configured: {:?}", configure);

        // Store configured size
        self.surface_width = configure.new_size.0;
        self.surface_height = configure.new_size.1;
        info!("Surface size: {}x{}", self.surface_width, self.surface_height);

        self.configured = true;

        // Create buffer pool if not exists (use configured size)
        if self.pool.is_none() && self.surface_width > 0 && self.surface_height > 0 {
            let pool = SlotPool::new(
                (self.surface_width * self.surface_height * 4) as usize,
                &self.shm_state,
            )
            .expect("create pool");
            self.pool = Some(pool);
        }

        // First draw
        self.draw(qh);
    }
}

impl ShmHandler for OverlayState {
    fn shm_state(&mut self) -> &mut Shm {
        &mut self.shm_state
    }
}

impl ProvidesRegistryState for OverlayState {
    fn registry(&mut self) -> &mut RegistryState {
        &mut self.registry_state
    }
    registry_handlers![OutputState];
}

delegate_compositor!(OverlayState);
delegate_output!(OverlayState);
delegate_layer!(OverlayState);
delegate_shm!(OverlayState);
delegate_registry!(OverlayState);

/// Run an animation overlay at the given position.
pub fn run_overlay(
    geometry: WindowGeometry,
    screenshot_data: Vec<u8>,
    animation: Arc<dyn Animation>,
) -> Result<()> {
    info!(
        "Starting overlay at ({}, {}) {}x{}",
        geometry.x, geometry.y, geometry.width, geometry.height
    );

    // Get duration before moving animation
    let duration_ms = animation.duration_ms();

    let conn = Connection::connect_to_env().context("Failed to connect to Wayland")?;

    let (globals, mut event_queue) =
        registry_queue_init(&conn).context("Failed to init registry")?;
    let qh = event_queue.handle();

    let compositor_state =
        CompositorState::bind(&globals, &qh).context("wl_compositor not available")?;
    let layer_shell = LayerShell::bind(&globals, &qh).context("layer_shell not available")?;
    let shm_state = Shm::bind(&globals, &qh).context("wl_shm not available")?;

    let surface = compositor_state.create_surface(&qh);

    // Create layer surface - overlay layer, anchored to top-left with margin offset
    let layer_surface = layer_shell.create_layer_surface(
        &qh,
        surface,
        Layer::Overlay,
        Some("hypr-vortex"),
        None, // No specific output - appears on all
    );

    // TEST: Anchor to all edges (fullscreen on output) to verify surface shows
    layer_surface.set_anchor(Anchor::TOP | Anchor::BOTTOM | Anchor::LEFT | Anchor::RIGHT);
    layer_surface.set_size(0, 0); // 0 = use anchor constraints (fullscreen)
    layer_surface.set_keyboard_interactivity(KeyboardInteractivity::None);
    layer_surface.set_exclusive_zone(-1); // Don't reserve space
    layer_surface.commit();

    info!("Layer surface created with fullscreen anchor for testing");

    let mut state = OverlayState {
        registry_state: RegistryState::new(&globals),
        compositor_state,
        output_state: OutputState::new(&globals, &qh),
        shm_state,
        layer_shell,
        layer_surface: Some(layer_surface),
        pool: None,
        geometry,
        animation,
        screenshot_data,
        surface_width: 0,
        surface_height: 0,
        start_time: Instant::now(),
        configured: false,
        done: false,
    };

    // Wait for initial configure event
    while !state.configured && !state.done {
        event_queue.blocking_dispatch(&mut state)?;
    }

    // Animation loop with forced frame timing
    let animation_duration = std::time::Duration::from_millis(duration_ms + 50);
    let start = std::time::Instant::now();
    let frame_time = std::time::Duration::from_millis(16); // ~60fps

    while !state.done && start.elapsed() < animation_duration {
        let frame_start = std::time::Instant::now();

        // Process any pending Wayland events
        let _ = event_queue.dispatch_pending(&mut state);

        // Draw frame
        if !state.done {
            state.draw(&qh);
        }

        // Flush to ensure buffer is sent
        if let Err(e) = event_queue.flush() {
            warn!("Flush error: {}", e);
        }

        // Sleep remainder of frame time
        let elapsed = frame_start.elapsed();
        if elapsed < frame_time {
            std::thread::sleep(frame_time - elapsed);
        }
    }

    info!("Animation complete");
    Ok(())
}
