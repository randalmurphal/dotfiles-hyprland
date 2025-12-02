//! Shrink animation - window shrinks to center point.

use crate::animation::{Animation, AnimationUniforms, Progress, ShaderSource};

pub struct ShrinkAnimation {
    duration_ms: u64,
}

impl ShrinkAnimation {
    pub fn new() -> Self {
        Self { duration_ms: 300 }
    }
}

impl Default for ShrinkAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl Animation for ShrinkAnimation {
    fn name(&self) -> &'static str {
        "shrink"
    }

    fn description(&self) -> &'static str {
        "Shrink window to center point"
    }

    fn duration_ms(&self) -> u64 {
        self.duration_ms
    }

    fn update_uniforms(&self, uniforms: &mut AnimationUniforms, progress: Progress) {
        uniforms.progress = progress;
    }

    fn ease(&self, t: f32) -> f32 {
        // Ease-in: starts slow, accelerates
        t * t * t
    }

    fn fragment_shader(&self) -> ShaderSource {
        r#"
struct Uniforms {
    progress: f32,
    time: f32,
    width: f32,
    height: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
    _pad4: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var tex_sampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let center = vec2<f32>(0.5, 0.5);
    let progress = u.progress;

    // Scale factor: 1.0 at start, 0.0 at end
    let scale = 1.0 - progress;

    // Transform UV: expand from center (inverse of shrink)
    let scaled_uv = center + (uv - center) / max(scale, 0.001);

    // Outside bounds = transparent
    if scaled_uv.x < 0.0 || scaled_uv.x > 1.0 || scaled_uv.y < 0.0 || scaled_uv.y > 1.0 {
        return vec4<f32>(0.0, 0.0, 0.0, 0.0);
    }

    var color = textureSample(tex, tex_sampler, scaled_uv);

    // Fade out near the end
    color.a = color.a * (1.0 - smoothstep(0.7, 1.0, progress));

    return color;
}
"#
    }
}
