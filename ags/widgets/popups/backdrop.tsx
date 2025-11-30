import app from "ags/gtk4/app"
import Astal from "gi://Astal?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { closeAllPopups } from "../../lib/popup-manager"

// Backdrop at TOP layer, below bar/popups (OVERLAY)
// marginTop keeps it from covering bar - bar clicks go directly to bar
// Click-away works for area below bar where popups appear
export default function PopupBackdrop() {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  const backdropButton = new Gtk.Button({
    hexpand: true,
    vexpand: true,
    canFocus: false,
  })
  backdropButton.add_css_class("backdrop-btn")
  backdropButton.connect("clicked", () => {
    closeAllPopups()
  })

  const win = new Astal.Window({
    name: "popup-backdrop",
    namespace: "popup-backdrop",  // No ags-* prefix = no blur
    application: app,
    anchor: TOP | BOTTOM | LEFT | RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.TOP,  // Below OVERLAY (bar/popups)
    keymode: Astal.Keymode.NONE,
    visible: false,
    marginTop: 38,  // Don't cover bar area
  })
  win.add_css_class("PopupBackdrop")
  win.set_child(backdropButton)

  return win
}
