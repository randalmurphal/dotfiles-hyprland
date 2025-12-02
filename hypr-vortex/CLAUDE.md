# hypr-vortex

Window close animation daemon for Hyprland. Creates a spaghettification black hole effect when closing windows - content stretches into spiral strands that get sucked into a central singularity.

## Architecture

```
Super+Q → vortex-close.sh → Unix socket → hypr-vortex daemon
                                              ↓
                                    1. Screenshot via grim
                                    2. Set window alpha to 0 (keeps tiling)
                                    3. Layer-shell overlay with animation
                                    4. Close window after animation
```

## Visual Effect

The animation creates a black hole effect with:
- **Spaghettification**: Window content stretches tangentially and compresses radially as it spirals into the center
- **Black singularity**: Growing void at center (0.03 → 0.05 radius)
- **Purple accretion disk**: 32 wispy light strands with variable brightness, length, and spiral tightness
- **x^4 acceleration**: Slow dramatic start, violent collapse at end

## Key Files

| File | Purpose |
|------|---------|
| `src/main.rs` | Daemon entry, socket IPC, connection handler |
| `src/overlay.rs` | Layer-shell surface, CPU vortex rendering, spaghettification math |
| `src/screenshot.rs` | Screenshot capture via grim |
| `src/animation.rs` | Animation trait and registry |
| `src/animations/vortex.rs` | Animation timing (900ms, x^4 ease) |
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
- `singularity_radius`: Size of central black void
- `disk_outer`: How far accretion disk extends
- `num_strands`: Number of purple light wisps (32)
- Strand properties: brightness (0.3-1.0), length (0.02-0.06), width, spiral tightness

Duration in `src/animations/vortex.rs` (900ms default)

## Technical Notes

- Uses `alpha 0` instead of special workspace to preserve tiling during animation
- Multi-monitor: uses `rem_euclid` for negative x coordinates (left monitor)
- CPU rendering with rayon parallelization (~60fps)
- ARGB8888 SHM buffers for Wayland layer-shell
- Pseudo-random strand variation using deterministic sin/cos seeding
