# Popup Architecture

This document details the popup system architecture, focusing on the backdrop layer configuration that enables both click-away and click-between-icons behavior.

## Problem Statement

We need two behaviors to work simultaneously:
1. **Click-away**: Clicking outside a popup closes it
2. **Click-between-icons**: Clicking a different bar icon switches popups without closing first

## Layer Shell Basics

Wayland's layer-shell protocol provides 4 layers (bottom to top):
```
BACKGROUND < BOTTOM < TOP < OVERLAY
```

Higher layers receive input before lower layers. Within the same layer, surfaces are stacked in creation order (first created = bottom).

## Architecture

### Component Layers

| Component | Layer | Exclusivity | Why |
|-----------|-------|-------------|-----|
| Bar | OVERLAY | EXCLUSIVE | Highest layer, reserves screen space |
| Popups | OVERLAY | IGNORE | Same layer as bar, created after so on top |
| Backdrop | TOP | IGNORE | Below OVERLAY, catches clicks not hitting bar/popups |

### Backdrop Configuration

```typescript
const win = new Astal.Window({
  name: "popup-backdrop",
  namespace: "popup-backdrop",     // NOT ags-* (avoids blur)
  anchor: TOP | BOTTOM | LEFT | RIGHT,
  exclusivity: Astal.Exclusivity.IGNORE,
  layer: Astal.Layer.TOP,          // Below OVERLAY
  marginTop: 38,                   // Don't cover bar area
  visible: false,
})
```

**Key settings:**
- `namespace: "popup-backdrop"` - Avoids matching `ags-.*` Hyprland rules (blur, ignorezero)
- `layer: Layer.TOP` - Below OVERLAY where bar/popups live
- `marginTop: 38` - Creates gap so backdrop doesn't cover bar
- Backdrop button has `background: rgba(0, 0, 0, 0.01)` - nearly invisible but clickable

### Click Flow

```
User clicks screen
        │
        ▼
┌─────────────────────────────────┐
│ Is click in bar area (top 38px)?│
└─────────────────────────────────┘
        │
   ┌────┴────┐
   │ YES     │ NO
   ▼         ▼
┌─────┐    ┌──────────────────────┐
│ Bar │    │ Is click on a popup? │
└─────┘    └──────────────────────┘
   │              │
   │         ┌────┴────┐
   │         │ YES     │ NO
   │         ▼         ▼
   │      ┌──────┐  ┌──────────┐
   │      │Popup │  │ Backdrop │
   │      └──────┘  └──────────┘
   │         │            │
   │         │            ▼
   │         │      closeAllPopups()
   ▼         ▼
togglePopup() → Switch or toggle popup
```

## Popup Manager

The `popup-manager.ts` handles popup state:

```typescript
let currentlyOpenPopup: string | null = null

export function togglePopup(name: string): void {
  const popup = app.get_window(name)
  if (!popup) return

  // Toggle off if same popup
  if (currentlyOpenPopup === name) {
    closeAllPopups()
    return
  }

  // Close previous popup (synchronous, no delays)
  if (currentlyOpenPopup !== null) {
    const oldPopup = app.get_window(currentlyOpenPopup)
    if (oldPopup) oldPopup.visible = false
  }

  // Show backdrop and new popup
  const backdrop = app.get_window("popup-backdrop")
  if (backdrop) backdrop.visible = true
  popup.visible = true
  currentlyOpenPopup = name
}
```

**Key design decisions:**
- Synchronous state changes (no setTimeout/delays)
- Single source of truth (`currentlyOpenPopup`)
- No focus handlers (caused race conditions)

## What Doesn't Work

### Backdrop at OVERLAY (same as bar)
- Z-order within layer determined by creation order
- Backdrop created after bar, so it's on top
- Blocks bar icon clicks

### Backdrop at TOP covering full screen
- Even with layer hierarchy, input routing had issues
- Bar clicks were being intercepted

### Using ignorezero with transparent region
- Required `ags-*` namespace to match Hyprland rules
- Also matched `blur` rule, causing unwanted blur effect

### Focus handlers (notify::is-active)
- GTK focus changes created race conditions
- Popup would close then immediately reopen
- Timing-dependent bugs

## Hyprland Layer Rules

```
layerrule = blur, ags-.*
layerrule = ignorezero, ags-.*
```

The backdrop intentionally uses `popup-backdrop` namespace to avoid these rules:
- No blur on backdrop (it should be invisible)
- No ignorezero (we want it clickable despite low alpha)

## Adding New Popups

1. Create popup window at `Layer.OVERLAY`
2. Use namespace matching `ags-*` for blur effect
3. Add to `POPUP_NAMES` in `constants.ts`
4. Create bar button that calls `togglePopup("popup-name")`
5. Add to `app.tsx` return array (after `PopupBackdrop`)
