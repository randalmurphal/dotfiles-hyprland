# hypr-vortex

Window close animation daemon for Hyprland. Creates vortex/black-hole effects when closing windows.

## Architecture

```
Super+Q → vortex-close.sh → Unix socket → hypr-vortex daemon
                                              ↓
                                    1. Screenshot via grim
                                    2. Set window alpha to 0 (keeps tiling)
                                    3. Layer-shell overlay with animation
                                    4. Close window after animation
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.rs` | Daemon entry, socket IPC, connection handler |
| `src/overlay.rs` | Layer-shell surface, CPU vortex rendering |
| `src/screenshot.rs` | Screenshot capture via grim |
| `src/animation.rs` | Animation trait and registry |
| `src/animations/*.rs` | Animation implementations (vortex, fade, shrink) |
| `vortex-close.sh` | Script bound to Super+Q |

## Building

```bash
cargo build --release
cp target/release/hypr-vortex ~/.local/bin/
cp vortex-close.sh ~/.local/bin/
```

## Configuration

In `hypr/hyprland.conf`:
```
# Disable default close animations
animation = windowsOut, 0, 1, default
animation = fadeOut, 0, 1, default

# Bind Super+Q to vortex close
bind = $mainMod, Q, exec, ~/.local/bin/vortex-close.sh

# Start daemon
exec-once = ~/.local/bin/hypr-vortex
```

## Animation Tuning

Edit `src/overlay.rs` `render_cpu_vortex()`:
- `spin_speed` (2.5): Rotation speed multiplier
- `pull_strength` (1.8): How fast pixels pull to center
- Duration in `src/animations/vortex.rs` (800ms default)

## Technical Notes

- Uses `alpha 0` instead of special workspace to preserve tiling during animation
- Multi-monitor: uses `rem_euclid` for negative x coordinates (left monitor)
- CPU rendering with rayon parallelization (~60fps on RTX 3090)
- ARGB8888 SHM buffers for Wayland layer-shell

## Future Improvements

- GPU rendering via wgpu (shader exists in vortex.rs but not wired up)
- Per-app animation selection
- Configurable parameters via config file
