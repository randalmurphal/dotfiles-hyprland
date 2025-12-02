//! Vortex/Black Hole animation - sucks window into a spinning void.

use crate::animation::{Animation, AnimationUniforms, Progress, ShaderSource};

pub struct VortexAnimation {
    /// Animation duration in ms
    duration_ms: u64,
    /// Rotation speed multiplier
    spin_speed: f32,
    /// How quickly it shrinks to center
    pull_strength: f32,
}

impl VortexAnimation {
    pub fn new() -> Self {
        Self {
            duration_ms: 800,  // Longer duration for smoother animation
            spin_speed: 3.0,
            pull_strength: 2.0,
        }
    }

    pub fn with_duration(mut self, ms: u64) -> Self {
        self.duration_ms = ms;
        self
    }

    pub fn with_spin_speed(mut self, speed: f32) -> Self {
        self.spin_speed = speed;
        self
    }

    pub fn with_pull_strength(mut self, strength: f32) -> Self {
        self.pull_strength = strength;
        self
    }
}

impl Default for VortexAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl Animation for VortexAnimation {
    fn name(&self) -> &'static str {
        "vortex"
    }

    fn description(&self) -> &'static str {
        "Black hole effect that sucks and spins the window into the void"
    }

    fn duration_ms(&self) -> u64 {
        self.duration_ms
    }

    fn update_uniforms(&self, uniforms: &mut AnimationUniforms, progress: Progress) {
        uniforms.progress = progress;
        uniforms.param1 = self.spin_speed;
        uniforms.param2 = self.pull_strength;
    }

    fn ease(&self, t: f32) -> f32 {
        // Ease-in-out for vortex - slow start, fast middle, slow end
        if t < 0.5 {
            4.0 * t * t * t
        } else {
            1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
        }
    }

    fn fragment_shader(&self) -> ShaderSource {
        r#"
// Vortex/Black Hole Animation Shader
// Sucks the window into a spinning void at the center

struct Uniforms {
    progress: f32,
    time: f32,
    width: f32,
    height: f32,
    spin_speed: f32,
    pull_strength: f32,
    _pad1: f32,
    _pad2: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var tex_sampler: sampler;

const PI: f32 = 3.14159265359;
const TWO_PI: f32 = 6.28318530718;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let progress = u.progress;
    let spin_speed = u.spin_speed;
    let pull_strength = u.pull_strength;

    // Center of the vortex (middle of texture)
    let center = vec2<f32>(0.5, 0.5);

    // Vector from center to current pixel
    let to_pixel = uv - center;
    let dist = length(to_pixel);
    let angle = atan2(to_pixel.y, to_pixel.x);

    // Vortex effect intensifies with progress
    // Rotation increases toward center and with progress
    let rotation_amount = spin_speed * progress * (1.0 - dist * 0.5);
    let new_angle = angle + rotation_amount * TWO_PI;

    // Pull toward center - distance shrinks with progress
    // More pull near the center creates the "sucking" effect
    let pull_factor = 1.0 - progress * pull_strength * (1.0 - dist * 0.3);
    let new_dist = dist * max(pull_factor, 0.0);

    // Convert back to UV coordinates
    let new_uv = center + vec2<f32>(
        cos(new_angle) * new_dist,
        sin(new_angle) * new_dist
    );

    // Sample the texture at distorted coordinates
    var color = textureSample(tex, tex_sampler, new_uv);

    // Edge darkening - vortex has dark edges
    let edge_darkness = smoothstep(0.0, 0.5, dist) * progress * 0.5;
    color = vec4<f32>(color.rgb * (1.0 - edge_darkness), color.a);

    // Fade out as we approach complete
    // Faster fade near center (it disappears into the void first)
    let center_dist = length(uv - center);
    let fade_progress = progress * 1.5; // Fade starts at ~66% progress
    let fade = 1.0 - smoothstep(0.0, 1.0, fade_progress - center_dist);

    // Final alpha combines texture alpha with fade
    color.a = color.a * fade;

    // Clamp UVs - pixels outside original texture are transparent
    if new_uv.x < 0.0 || new_uv.x > 1.0 || new_uv.y < 0.0 || new_uv.y > 1.0 {
        color.a = 0.0;
    }

    return color;
}
"#
    }
}
