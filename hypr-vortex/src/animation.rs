//! Extensible animation system for window close effects.
//!
//! Add new animations by implementing the `Animation` trait and registering
//! them in the `AnimationRegistry`.

use std::collections::HashMap;
use std::sync::Arc;

/// Window geometry for positioning the animation overlay.
#[derive(Debug, Clone, Copy)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// Animation progress from 0.0 (start) to 1.0 (complete).
pub type Progress = f32;

/// WGSL shader source code.
pub type ShaderSource = &'static str;

/// Animation configuration passed to shaders.
#[derive(Debug, Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
#[repr(C)]
pub struct AnimationUniforms {
    /// Animation progress 0.0 to 1.0
    pub progress: f32,
    /// Time in seconds since animation started
    pub time: f32,
    /// Texture width
    pub width: f32,
    /// Texture height
    pub height: f32,
    /// Animation-specific parameter 1
    pub param1: f32,
    /// Animation-specific parameter 2
    pub param2: f32,
    /// Animation-specific parameter 3
    pub param3: f32,
    /// Animation-specific parameter 4
    pub param4: f32,
}

impl Default for AnimationUniforms {
    fn default() -> Self {
        Self {
            progress: 0.0,
            time: 0.0,
            width: 0.0,
            height: 0.0,
            param1: 0.0,
            param2: 0.0,
            param3: 0.0,
            param4: 0.0,
        }
    }
}

/// Trait for implementing window close animations.
///
/// Each animation provides a WGSL fragment shader that transforms
/// the window screenshot based on animation progress.
pub trait Animation: Send + Sync {
    /// Unique name for this animation (e.g., "vortex", "shatter", "melt").
    fn name(&self) -> &'static str;

    /// Human-readable description.
    fn description(&self) -> &'static str;

    /// Duration of the animation in milliseconds.
    fn duration_ms(&self) -> u64;

    /// WGSL fragment shader source.
    ///
    /// The shader receives:
    /// - `uniforms.progress`: 0.0 to 1.0
    /// - `uniforms.time`: seconds since start
    /// - `uniforms.width/height`: texture dimensions
    /// - `uniforms.param1-4`: animation-specific parameters
    /// - `texture`: the window screenshot
    /// - `sampler`: texture sampler
    ///
    /// Output: vec4<f32> RGBA color for each fragment.
    fn fragment_shader(&self) -> ShaderSource;

    /// Update animation-specific uniform parameters.
    /// Called each frame with current progress.
    fn update_uniforms(&self, uniforms: &mut AnimationUniforms, progress: Progress) {
        uniforms.progress = progress;
    }

    /// Easing function for animation progress.
    /// Default: ease-out cubic for smooth deceleration.
    fn ease(&self, t: f32) -> f32 {
        // Ease-out cubic: 1 - (1 - t)^3
        let inv = 1.0 - t;
        1.0 - inv * inv * inv
    }
}

/// Registry of available animations.
pub struct AnimationRegistry {
    animations: HashMap<&'static str, Arc<dyn Animation>>,
    default: &'static str,
}

impl AnimationRegistry {
    pub fn new() -> Self {
        Self {
            animations: HashMap::new(),
            default: "vortex",
        }
    }

    /// Register an animation.
    pub fn register<A: Animation + 'static>(&mut self, animation: A) {
        let name = animation.name();
        self.animations.insert(name, Arc::new(animation));
    }

    /// Get an animation by name.
    pub fn get(&self, name: &str) -> Option<Arc<dyn Animation>> {
        self.animations.get(name).cloned()
    }

    /// Get the default animation.
    pub fn default_animation(&self) -> Arc<dyn Animation> {
        self.animations.get(self.default).cloned().expect("default animation must exist")
    }

    /// Set the default animation name.
    pub fn set_default(&mut self, name: &'static str) {
        self.default = name;
    }

    /// List all registered animation names.
    pub fn list(&self) -> Vec<&'static str> {
        self.animations.keys().copied().collect()
    }
}

impl Default for AnimationRegistry {
    fn default() -> Self {
        Self::new()
    }
}
