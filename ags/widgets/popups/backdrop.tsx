import app from "ags/gtk4/app"
import Astal from "gi://Astal?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { closeAllPopups } from "../../lib/popup-manager"

// Transparent backdrop below bar to catch outside clicks
// Does NOT cover bar area - only BOTTOM|LEFT|RIGHT with top margin
export default function PopupBackdrop() {
  const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

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
    namespace: "popup-backdrop",
    application: app,
    // Don't anchor TOP - let bar area remain clickable
    anchor: BOTTOM | LEFT | RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.OVERLAY,
    keymode: Astal.Keymode.NONE,
    visible: false,
    // Stay below the bar
    marginTop: 38,
  })
  win.add_css_class("PopupBackdrop")
  win.set_child(backdropButton)

  return win
}
