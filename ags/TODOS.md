# AGS Refactoring TODOs

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Infrastructure (MUST complete before other phases)

### 1.1 Create Shared Constants
- [x] Create `lib/constants/polling.ts` - All polling intervals in one place
  - `SYSTEM_MONITOR_POLL_MS = 2000`
  - `NETWORK_POLL_MS = 2000`
  - `BLUETOOTH_POLL_MS = 2000`
  - `MEDIA_POLL_MS = 2000`
  - `WEATHER_CACHE_POLL_MS = 30000`
  - `SEARCH_DEBOUNCE_MS = 300`

- [x] Create `lib/constants/ui.ts` - UI magic numbers
  - `POPUP_WIDTH_SMALL = 204`
  - `POPUP_WIDTH_MEDIUM = 255`
  - `POPUP_WIDTH_LARGE = 300`
  - `DROPDOWN_MAX_CHARS = 34`
  - `HOURLY_FORECAST_COUNT = 5`
  - `DAILY_FORECAST_COUNT = 5`

- [x] Create `lib/weather-codes.ts` - WMO weather codes (currently duplicated)
  - Move from `widgets/bar/Weather.tsx` lines 14-47
  - Move from `widgets/popups/weather/WeatherPopup.tsx` lines 37-70
  - Export `getWeatherInfo(code)` function
  - Export `weatherCodes` map

### 1.2 Expand ui-components.ts
- [x] Add `clearContainer(container: Gtk.Box)` helper
  - Currently duplicated in: AudioPopup (line 117-124), WeatherPopup (multiple places)
- [x] Add `triggerWindowResize(window: Astal.Window)` helper
  - Currently duplicated in: AudioPopup (line 32-34), WeatherPopup (line 351-353)
- [ ] Consider: Extract dropdown component from AudioPopup (~300 lines of similar code)

### 1.3 Consolidate system-commands.ts
- [x] Add `spawnSyncOutput(command): { ok: boolean, output: string, error?: string }`
  - Replace direct `GLib.spawn_command_line_sync` calls throughout codebase
- [x] Add proper error logging instead of silent catches (via lib/logger.ts)
- [ ] Files using direct GLib.spawn:
  - `SystemMonitor.tsx` (line 93)
  - `WeatherPopup.tsx` (lines 170, 238, 264, 318)
  - `AudioPopup.tsx` (lines 110, 573, 574, 587, 598, 599)
  - `network-utils.ts`
  - `bluetooth-utils.ts`

---

## Phase 2: Error Handling (can run parallel after Phase 1)

### 2.1 Fix Silent Error Catches
Files with `catch { // ignore }` patterns:

- [x] `widgets/bar/SystemMonitor.tsx`
  - Lines 39, 63, 88, 108 - Replace with logged errors
  - Consider: Show "N/A" for unavailable metrics instead of silent 0

- [x] `widgets/popups/weather/WeatherPopup.tsx`
  - All silent catches replaced with logError calls

- [x] `widgets/popups/network/network-utils.ts` - No changes needed (no try/catch)

- [x] `widgets/popups/bluetooth/bluetooth-utils.ts` - No changes needed (no try/catch)

### 2.2 Add Error Logging Helper
- [x] Create `lib/logger.ts` with consistent logging pattern
  ```typescript
  export function logError(context: string, error: unknown): void {
    print(`[${context}] Error: ${error}`)
  }
  ```

---

## Phase 3: Code Cleanup (can run parallel after Phase 1)

### 3.1 Remove Dead Code
- [x] Delete `widgets/popups/media/MediaPopup.tsx` (unused - media in AudioPopup now)
- [x] Keep SCSS in `style.scss` with comment (for future reference)
- [x] "media-popup" was not in POPUP_NAMES (already clean)
- [x] Clean up comment in app.tsx

### 3.2 Keep But Don't Use
- [x] `widgets/system-tray/Media.tsx` - Keep file with documentation comment
- [x] `widgets/system-tray/Network.tsx` - Keep file with documentation comment
- [x] Add comments to both files explaining they're intentionally excluded

---

## Phase 4: DRY Refactoring (after Phase 1)

### 4.1 Weather Code Consolidation
- [x] Update `widgets/bar/Weather.tsx` to import from `lib/weather-codes.ts`
- [x] Update `widgets/popups/weather/WeatherPopup.tsx` to import from `lib/weather-codes.ts`
- [x] Ensure consistent icon/description mapping

### 4.2 Use Shared Polling Constants
Update all files to use constants from `lib/constants/polling.ts`:
- [x] `widgets/bar/SystemMonitor.tsx`
- [x] `widgets/system-tray/Network.tsx`
- [x] `widgets/system-tray/Bluetooth.tsx`
- [x] `widgets/system-tray/Media.tsx`
- [x] `widgets/bar/Weather.tsx`
- [x] `widgets/bar/Clock.tsx`
- [x] `widgets/popups/weather/WeatherPopup.tsx`
- [x] `widgets/popups/audio/AudioPopup.tsx`

### 4.3 Use Shared UI Constants
- [x] `widgets/popups/audio/AudioPopup.tsx` - POPUP_WIDTH_MEDIUM, DROPDOWN_MAX_CHARS
- [x] `widgets/popups/weather/WeatherPopup.tsx` - HOURLY_FORECAST_COUNT, ESCAPE_KEYVAL

### 4.4 Use clearContainer Helper
- [x] `widgets/popups/audio/AudioPopup.tsx` - Using imported clearContainer
- [x] `widgets/popups/weather/WeatherPopup.tsx` - Still uses inline (different pattern)

### 4.5 Use system-commands.ts Consistently
Replace all direct GLib.spawn_command_line_sync/async calls:
- [x] `widgets/bar/SystemMonitor.tsx` - Using spawnSyncOutput
- [x] `widgets/bar/Weather.tsx` - Using readFileSync
- [x] `widgets/popups/weather/WeatherPopup.tsx` - Using getCacheDir, getConfigDir, readFileSync
- [ ] `widgets/popups/audio/AudioPopup.tsx` - Still uses direct GLib (works fine)
- [ ] `widgets/popups/power/PowerPopup.tsx` - Still uses direct GLib (works fine)

---

## Phase 5: Documentation Update (after all refactoring)

### 5.1 Update CLAUDE.md
- [x] Document new lib/ structure
- [x] Update file structure section
- [x] Add coding style guidelines for constants/logging
- [x] Update triggerWindowResize example

### 5.2 Code Comments
- [x] JSDoc added to new lib/ exports
- [x] Documentation comments added to excluded tray components

---

## Parallel Execution Plan

```
Phase 1 (Sequential - Infrastructure)
├── 1.1 Create constants files
├── 1.2 Expand ui-components.ts
└── 1.3 Consolidate system-commands.ts

Phase 2-4 (Parallel - Can run simultaneously after Phase 1)
├── Agent A: Error handling (2.1, 2.2)
├── Agent B: Code cleanup (3.1, 3.2)
├── Agent C: Weather DRY (4.1)
├── Agent D: Polling constants (4.2)
├── Agent E: UI constants + clearContainer (4.3, 4.4)
└── Agent F: system-commands usage (4.5)

Phase 5 (Sequential - After all above)
└── Documentation update
```

---

## File Dependency Map

Files that import from lib/:
- `constants.ts` → Most widget files
- `system-commands.ts` → Caffeine, MediaPopup
- `ui-components.ts` → BrightnessPopup, MediaPopup, WifiPopup, BluetoothPopup
- `popup-manager.ts` → All popup files, tray buttons

New imports needed after refactor:
- `lib/constants/polling.ts` → All polling components
- `lib/constants/ui.ts` → All popups
- `lib/weather-codes.ts` → Weather.tsx, WeatherPopup.tsx
- `lib/logger.ts` → All files with try/catch

---

## Testing Checklist
After refactoring, verify:
- [ ] Bar displays correctly (workspaces, clients, clock, weather, system monitor)
- [ ] All system tray buttons work
- [ ] All popups open/close properly
- [ ] Escape key closes popups
- [ ] Click-away closes popups
- [ ] Weather search works
- [ ] Audio controls work (volume, mute, device selection)
- [ ] Media controls work in AudioPopup
- [ ] Brightness slider works
- [ ] Night light toggle works
- [ ] Bluetooth device list shows
- [ ] Calendar popup opens
- [ ] Notifications display
- [ ] Power menu works
