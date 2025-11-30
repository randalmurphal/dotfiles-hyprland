import app from "ags/gtk4/app"
import { POPUP_NAMES } from "./constants"

// Track which popup is currently open
let currentlyOpenPopup: string | null = null

export function closeAllPopups(): void {
  POPUP_NAMES.forEach(name => {
    const popup = app.get_window(name)
    if (popup && popup.visible) popup.visible = false
  })

  const backdrop = app.get_window("popup-backdrop")
  if (backdrop) backdrop.visible = false

  currentlyOpenPopup = null
}

export function togglePopup(name: string): void {
  const popup = app.get_window(name)
  if (!popup) return

  // If this popup is currently open, close it
  if (currentlyOpenPopup === name) {
    closeAllPopups()
    return
  }

  // Close any other popup first (synchronously, no delays)
  if (currentlyOpenPopup !== null && currentlyOpenPopup !== name) {
    const oldPopup = app.get_window(currentlyOpenPopup)
    if (oldPopup) oldPopup.visible = false
  }

  // Open the new popup and backdrop
  const backdrop = app.get_window("popup-backdrop")
  if (backdrop) backdrop.visible = true
  popup.visible = true
  currentlyOpenPopup = name
}
