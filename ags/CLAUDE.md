# AGS Desktop Shell Configuration

Custom AGS (Aylur's GTK Shell) v3 configuration for Hyprland desktop environment with a macOS-inspired dark purple aesthetic.

## Stack

| Component | Technology |
|-----------|------------|
| Shell Framework | AGS v3 (GTK4 + TypeScript) |
| Window Manager | Hyprland |
| Display Protocol | Wayland |
| Type Definitions | `@girs/` (auto-generated) |
| Runtime | GJS (GNOME JavaScript) |

## Running AGS

```bash
# Standard run (from this directory)
GI_TYPELIB_PATH=/usr/local/lib64/girepository-1.0 ags run

# Kill and restart
pkill -9 gjs && GI_TYPELIB_PATH=/usr/local/lib64/girepository-1.0 ags run

# Toggle launcher via hyprctl
ags toggle launcher
```

## Design Philosophy

### Visual Style
- **macOS Spotlight-inspired**: Clean, minimal, pill-shaped elements
- **Dark theme with purple accents**: Deep backgrounds with vibrant purple highlights
- **Modern opacity**: Semi-transparent backgrounds (~85%) for depth
- **Blur effects**: Hyprland layer blur for glass-like appearance

### Color Palette

| Variable | Hex | Usage |
|----------|-----|-------|
| `$purple-primary` | `#9d4edd` | Primary accent - use for ALL purple text/icons for consistency |
| `$purple-secondary` | `#7b2cbf` | Hover/press states only (darker feedback) |
| `$purple-dim` | `#5a189a` | Deep accent, borders |
| `$bg-darker` | `#0d0d0d` | Darkest background |
| `$bg-dark` | `#121218` | Primary background |
| `$bg-medium` | `#1a1a2e` | Secondary background |
| `$text-primary` | `#e0e0e0` | Primary text |
| `$text-secondary` | `#a0a0a0` | Muted text |
| `$text-dim` | `#666` | Placeholder, disabled |

### Design Decisions

1. **Launcher**: macOS Spotlight-style search
   - Pill-shaped (24px border-radius)
   - 2px solid purple border
   - Dynamic height (shrinks with fewer results)
   - Debounced search (50ms) to prevent lag
   - Lazy app initialization to avoid startup cost

2. **Status Bar**: Minimal top bar
   - Workspace indicators per-monitor
   - Client icons for current workspace
   - System tray with popups (audio, brightness, wifi, bluetooth)
   - Click-outside-to-close for popups via backdrop layer

3. **Popups**: Consistent control panels
   - Rounded corners (16px)
   - Purple accent colors
   - Toggle switches with ON/OFF states
   - Settings buttons linking to KDE system settings

## File Structure

```
.
├── app.tsx                 # Minimal entry point (~44 lines)
├── launcher.tsx            # Spotlight-style app launcher
├── style.scss              # All styles (SCSS with variables)
├── lib/                    # Shared utilities
│   ├── constants.ts        # Workspace mapping, icons, POPUP_NAMES
│   ├── constants/          # Centralized magic numbers
│   │   ├── polling.ts      # All polling intervals (SYSTEM_MONITOR_POLL_MS, etc.)
│   │   └── ui.ts           # UI constants (popup widths, max chars)
│   ├── weather-codes.ts    # WMO weather code mapping (shared by bar + popup)
│   ├── logger.ts           # Centralized error/debug logging
│   ├── system-commands.ts  # GLib wrappers (spawn, file ops, readFileSync)
│   ├── popup-manager.ts    # Popup state management
│   └── ui-components.ts    # Reusable UI (toggle buttons, escape handlers, clearContainer)
├── widgets/
│   ├── bar/                # Status bar components
│   │   ├── index.tsx       # Bar window composition
│   │   ├── Workspaces.tsx  # Per-monitor workspace indicators
│   │   ├── Clients.tsx     # Active window icons
│   │   ├── Clock.tsx       # Time and date display
│   │   ├── SystemMonitor.tsx # CPU/RAM/GPU/VRAM stats
│   │   └── Weather.tsx     # Weather icon and temp in bar
│   ├── system-tray/        # Tray button components
│   │   ├── index.tsx       # SystemTray composition
│   │   ├── Audio.tsx       # Volume button
│   │   ├── Brightness.tsx  # Brightness button
│   │   ├── Network.tsx     # WiFi status button
│   │   ├── Bluetooth.tsx   # Bluetooth status button
│   │   └── Caffeine.tsx    # Screen sleep toggle
│   └── popups/             # Popup windows
│       ├── backdrop.tsx    # Click-outside-to-close layer (non-ags namespace to avoid blur)
│       ├── audio/AudioPopup.tsx  # Volume, device selection, media controls
│       ├── media/
│       │   └── media-utils.ts    # playerctl wrapper (MediaPopup.tsx removed - in AudioPopup now)
│       ├── brightness/
│       │   ├── BrightnessPopup.tsx
│       │   └── night-light.ts  # Sunrise/sunset calculation
│       ├── network/
│       │   ├── WifiPopup.tsx
│       │   └── network-utils.ts
│       ├── bluetooth/
│       │   ├── BluetoothPopup.tsx
│       │   └── bluetooth-utils.ts
│       └── weather/
│           └── WeatherPopup.tsx  # Weather popup with forecast and location search
├── @girs/                  # Type definitions (gitignored)
├── screenshots/            # Reference screenshots
└── CLAUDE.md               # This file
```

## Key Patterns

### Window Creation (Layer Shell)
```typescript
const window = new Astal.Window({
  name: "unique-name",
  namespace: "ags-unique-name",  // For Hyprland layer rules
  application: app,
  anchor: Astal.WindowAnchor.TOP,
  exclusivity: Astal.Exclusivity.IGNORE,
  keymode: Astal.Keymode.ON_DEMAND,
  visible: false,
})
```

### Reactive Bindings
```typescript
const value = createBinding(object, "property")
// Use in JSX:
<label label={value((v) => `${v}%`)} />
```

### Polling
```typescript
const data = createPoll(initialValue, intervalMs, () => fetchData())
```

### Debouncing with GLib
```typescript
let timer: number | null = null
function debouncedFn() {
  if (timer) GLib.source_remove(timer)
  timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
    doWork()
    timer = null
    return GLib.SOURCE_REMOVE
  })
}
```

### Dynamic Window Resize (Layer Shell)
Layer shell windows don't auto-shrink when content is hidden. Use the shared helper:
```typescript
import { triggerWindowResize } from "../../lib/ui-components"

let winRef: Astal.Window | null = null

// Call after visibility changes (e.g., dropdown toggle)
optionsBox.visible = !optionsBox.visible
triggerWindowResize(winRef)
```

## Hyprland Integration

### Keybinds (in hyprland.conf)
```
bind = $mainMod, D, exec, ags toggle launcher
bind = ALT, SPACE, exec, ags toggle launcher
```

### Layer Rules (for blur effects)
```
layerrule = blur, ags-.*
layerrule = ignorezero, ags-.*
layerrule = noanim, ags-launcher  # Disable animation for dynamic resize
```

**Popup Backdrop Architecture:**
The backdrop enables two behaviors: click-away (close popup by clicking outside) AND click-between-icons (switch popups by clicking different bar icons).

Layer hierarchy: `BACKGROUND < BOTTOM < TOP < OVERLAY`

| Component | Layer | Why |
|-----------|-------|-----|
| Bar | OVERLAY | Above backdrop, receives clicks directly |
| Popups | OVERLAY | Above backdrop, receive clicks directly |
| Backdrop | TOP | Below OVERLAY, catches remaining clicks |

**Critical configuration:**
- Backdrop namespace: `popup-backdrop` (NOT `ags-*`) to avoid blur from Hyprland rules
- Backdrop marginTop: 38px to not cover bar area
- Backdrop anchors all sides but margin creates gap at top
- Backdrop has minimal alpha (0.01) so it's clickable but nearly invisible

**Why this works:**
- Clicks on bar icons → hit bar (OVERLAY, above backdrop)
- Clicks on popups → hit popups (OVERLAY, above backdrop)
- Clicks elsewhere below bar → hit backdrop (TOP) → closes popup

**What doesn't work (lessons learned):**
- Backdrop at OVERLAY same as bar → blocks bar clicks (z-order within layer is creation order)
- Backdrop at TOP covering full screen → still blocks bar (layer-shell input routing issue)
- Using `ignorezero` with transparent region → requires `ags-*` namespace which adds blur
- Focus handlers (`notify::is-active`) → race conditions with toggle logic

### Workspace-to-Monitor Mapping
```typescript
const WORKSPACE_MONITOR_MAP: Record<string, number[]> = {
  "DP-3": [1, 2, 3, 10],      // Center (primary)
  "DP-1": [4, 5, 6],          // Left
  "HDMI-A-1": [7, 8, 9],      // Right
}
```

## Future Work

- [ ] Add window representation to bar (like macOS dock highlighting)
- [ ] Notification center
- [ ] VPN toggle in network popup
- [x] Power menu widget
- [x] Calendar popup for clock
- [x] Media controls in audio popup (with playerctl ignore for wallpaper players)
- [x] Weather popup with forecasts, location search, and default location star

## Coding Style

- TypeScript with strict null checks
- Functional components where possible
- Avoid unnecessary abstractions
- CSS classes over inline styles
- Keep popup logic self-contained
- Use GLib for timers, not setTimeout (GJS limitation)
- **Use constants from `lib/constants/`** - No hardcoded polling intervals or magic numbers
- **Use `logError()` from `lib/logger.ts`** - No silent catch blocks
- **Use helpers from `lib/ui-components.ts`** - clearContainer, triggerWindowResize, addEscapeHandler
- **Use `lib/weather-codes.ts`** - Single source of truth for WMO code mapping

## GTK4 CSS Limitations

GTK4's CSS subset differs from web CSS. Avoid these unsupported properties:

| Unsupported | Alternative |
|-------------|-------------|
| `overflow` | Not needed - GTK handles clipping |
| `position`, `top`, `right`, `left`, `bottom` | Use GTK box packing/layout |
| `max-width`, `max-height` | Set in widget props or use `min-*` |
| `text-align`, `justify-content` | Use `halign`/`valign` widget props |
| `margin: auto` | Use `halign: center` or `hexpand` |
| `border-radius: 50%` | Use large pixel value (`999px`) |
| `hexpand`, `vexpand` in CSS | These are widget properties, not CSS |

**SCSS:** Use `@use "sass:color"` with `color.adjust()` instead of deprecated `lighten()`/`darken()`.

## Testing Changes

1. Make edits to source files
2. Restart AGS: `pkill -9 gjs && ags run`
3. Test functionality (keybinds, popups, etc.)
4. Check for console errors in AGS output

## Dependencies

- `ags` CLI (AGS v3)
- `astal` libraries (Apps, Hyprland, WirePlumber)
- `nmcli` for WiFi management
- `bluetoothctl` for Bluetooth
- `playerctl` for media controls (uses `-i` flag to ignore wallpaper players like mpv)
- Nerd Fonts for icons (Symbols Nerd Font)
- `jq` and `curl` for weather fetching script
- Weather data: `~/.local/bin/ags-weather-fetch` (run via systemd timer) writes to `~/.cache/ags-weather.json`
- Weather config: `~/.config/ags/weather.conf` (LAT/LON variables) - defaults to Austin, TX
