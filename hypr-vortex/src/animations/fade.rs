//! Simple fade-out animation (for testing/fallback).

use crate::animation::{Animation, AnimationUniforms, Progress, ShaderSource};

pub struct FadeAnimation {
    duration_ms: u64,
}

impl FadeAnimation {
    pub fn new() -> Self {
        Self { duration_ms: 200 }
    }
}

impl Default for FadeAnimation {
    fn default() -> Self {
        Self::new()
    }
}

impl Animation for FadeAnimation {
    fn name(&self) -> &'static str {
        "fade"
    }

    fn description(&self) -> &'static str {
        "Simple fade to transparent"
    }

    fn duration_ms(&self) -> u64 {
        self.duration_ms
    }

    fn update_uniforms(&self, uniforms: &mut AnimationUniforms, progress: Progress) {
        uniforms.progress = progress;
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
    var color = textureSample(tex, tex_sampler, uv);
    color.a = color.a * (1.0 - u.progress);
    return color;
}
"#
    }
}
