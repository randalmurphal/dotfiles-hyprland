# Hyprland Plugin Development Notes

## Project Status: INCOMPLETE
Window close animation plugin - callbacks work, render hooks fire, but visual output never appears.

## Critical Hyprland Plugin Bugs

### Plugin Reload Bug (Hyprland #2178)
After a plugin crashes (SIGSEGV) or is unloaded, callbacks registered by subsequent plugin loads DO NOT FIRE, even with:
- Different .so file paths
- Unique filenames per load
- Global vs static callback handles

**Workaround**: Full Hyprland restart (logout/login) required after any plugin crash or to test new versions reliably.

### Config Reload Disables Logs
Every `hyprctl plugin load/unload` triggers config reload which resets `debug:disable_logs = true`.

**Workaround**: Always run after plugin operations:
```bash
hyprctl keyword debug:disable_logs false
```

## Development Workflow

### Finding Current Hyprland Instance
```bash
ls -t /run/user/1000/hypr/ | head -1
# Use this as HYPRLAND_INSTANCE_SIGNATURE
```

### Loading Plugins
```bash
export HYPRLAND_INSTANCE_SIGNATURE=<instance_id>
hyprctl keyword debug:disable_logs false
hyprctl plugin load /path/to/plugin.so
```

### Checking Plugin Status
```bash
hyprctl plugin list
```

### Viewing Logs
```bash
tail -f /run/user/1000/hypr/<instance_id>/hyprland.log | grep -i "YourPlugin"
```

## API Patterns

### Callback Registration
Use global (not static local) callback handles to ensure re-registration on reload:
```cpp
static SP<HOOK_CALLBACK_FN> g_myCallback;  // Global scope

PLUGIN_INIT() {
    g_myCallback = HyprlandAPI::registerCallbackDynamic(PHANDLE, "eventName", ...);
}

PLUGIN_EXIT() {
    g_myCallback.reset();  // Clean up
}
```

### Safe Window Access
```cpp
auto window = std::any_cast<PHLWINDOW>(data);
if (!window || !window->m_realPosition || !window->m_realSize)
    return;
Vector2D pos = window->m_realPosition->goal();
Vector2D size = window->m_realSize->goal();
```

### Render Hook Safety
Check for valid GL context before rendering:
```cpp
auto monitor = g_pHyprOpenGL->m_renderData.pMonitor.lock();
if (!monitor) return;
```

### Coordinate Transformation
Render coordinates must be monitor-local and scaled:
```cpp
CBox box = CBox{x - monitor->m_position.x, y - monitor->m_position.y, w, h}
    .scale(monitor->m_scale);
```

## Render Stages
| Stage | Description |
|-------|-------------|
| `RENDER_PRE_WINDOWS` | Before windows rendered |
| `RENDER_POST_WINDOWS` | After windows, before overlays |
| `RENDER_LAST_MOMENT` | Final GL context opportunity |

## What Works
- `closeWindow` callback fires reliably on first plugin load
- `render` callback fires at correct stages
- Window geometry accessible via `m_realPosition->goal()`
- `renderRect()` doesn't crash with proper context check

## Unsolved Issues
- `renderRect()` output never visible despite callback firing
- Tried: different render stages, coordinate scaling, solid colors
- May need: blend mode setup, scissor configuration, or different render approach

## Build Commands
```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

## Dependencies
- Hyprland headers (build from source at same version as running Hyprland)
- hyprutils, hyprlang
