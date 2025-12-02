//! Built-in animation implementations.

mod fade;
mod shrink;
mod vortex;

pub use fade::FadeAnimation;
pub use shrink::ShrinkAnimation;
pub use vortex::VortexAnimation;

use crate::animation::AnimationRegistry;

/// Register all built-in animations.
pub fn register_all(registry: &mut AnimationRegistry) {
    registry.register(VortexAnimation::new());
    registry.register(FadeAnimation::new());
    registry.register(ShrinkAnimation::new());
    registry.set_default("vortex");
}
