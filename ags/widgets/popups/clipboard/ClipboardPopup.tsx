import app from "ags/gtk4/app"
import Astal from "gi://Astal?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import GLib from "gi://GLib"
import { closeAllPopups } from "../../../lib/popup-manager"
import { addEscapeHandler } from "../../../lib/ui-components"
import { spawnSyncOutput } from "../../../lib/system-commands"

const MAX_ITEMS = 50
const MAX_PREVIEW_LENGTH = 60

interface ClipboardItem {
  id: string
  preview: string
  isImage: boolean
}

function getClipboardHistory(): ClipboardItem[] {
  const result = spawnSyncOutput("cliphist list")
  if (!result.ok || !result.output.trim()) return []

  return result.output
    .trim()
    .split("\n")
    .slice(0, MAX_ITEMS)
    .map(line => {
      // cliphist format: "id\tpreview" (tab-separated)
      const tabIndex = line.indexOf("\t")
      if (tabIndex === -1) return null

      const id = line.substring(0, tabIndex)
      let preview = line.substring(tabIndex + 1)

      // Check if it's binary/image data
      const isImage = preview.startsWith("[[ binary data ")

      // Truncate long previews
      if (preview.length > MAX_PREVIEW_LENGTH) {
        preview = preview.substring(0, MAX_PREVIEW_LENGTH) + "..."
      }

      // Clean up whitespace for display
      preview = preview.replace(/\s+/g, " ").trim()

      return { id, preview, isImage }
    })
    .filter((item): item is ClipboardItem => item !== null)
}

function copyItem(id: string): void {
  // Use cliphist decode to get content and pipe to wl-copy
  GLib.spawn_command_line_async(`bash -c 'cliphist decode ${id} | wl-copy'`)
}

function deleteItem(id: string): void {
  // cliphist delete reads from stdin, so we pipe the matching line
  GLib.spawn_command_line_async(`bash -c "cliphist list | grep '^${id}	' | cliphist delete"`)
}

function clearAll(): void {
  GLib.spawn_command_line_async("cliphist wipe")
}

export function ClipboardPopup() {
  const { TOP, RIGHT } = Astal.WindowAnchor

  // Container for clipboard list
  const clipboardListBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  clipboardListBox.add_css_class("clipboard-list")

  // Container for count badge
  const countBadgeContainer = new Gtk.Box()

  function refreshClipboard() {
    const items = getClipboardHistory()

    // Clear list
    let child = clipboardListBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      clipboardListBox.remove(child)
      child = next
    }

    // Update count badge
    const oldBadge = countBadgeContainer.get_first_child()
    if (oldBadge) countBadgeContainer.remove(oldBadge)

    if (items.length > 0) {
      const badge = new Gtk.Label({ label: `${items.length}` })
      badge.add_css_class("count-badge")
      countBadgeContainer.append(badge)
    }

    // Build item list
    if (items.length > 0) {
      items.forEach(item => {
        const itemBox = new Gtk.Box({ spacing: 8 })
        itemBox.add_css_class("clipboard-item")

        // Icon
        const icon = new Gtk.Label({
          label: item.isImage ? "󰋩" : "󰆏",
        })
        icon.add_css_class("clipboard-icon")
        itemBox.append(icon)

        // Preview text (clickable to copy)
        const previewBtn = new Gtk.Button()
        previewBtn.add_css_class("clipboard-preview")
        previewBtn.hexpand = true

        const previewLabel = new Gtk.Label({
          label: item.isImage ? "(image)" : item.preview || "(empty)",
          xalign: 0,
          ellipsize: 3, // END
          maxWidthChars: 40,
        })
        previewBtn.set_child(previewLabel)

        previewBtn.connect("clicked", () => {
          copyItem(item.id)
          closeAllPopups()
        })
        itemBox.append(previewBtn)

        // Delete button
        const deleteBtn = new Gtk.Button({ label: "󰅖" })
        deleteBtn.add_css_class("clipboard-delete-btn")
        deleteBtn.connect("clicked", () => {
          deleteItem(item.id)
          // Small delay to let cliphist process the delete
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            refreshClipboard()
            return GLib.SOURCE_REMOVE
          })
        })
        itemBox.append(deleteBtn)

        clipboardListBox.append(itemBox)
      })
    } else {
      const emptyLabel = new Gtk.Label({ label: "Clipboard empty" })
      emptyLabel.add_css_class("empty-label")
      clipboardListBox.append(emptyLabel)
    }
  }

  // Scrolled window for clipboard list
  const scrolledWindow = new Gtk.ScrolledWindow({
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
    minContentHeight: 100,
    maxContentHeight: 400,
  })
  scrolledWindow.set_child(clipboardListBox)

  const win = (
    <window
      visible={false}
      namespace="ags-clipboard-popup"
      name="clipboard-popup"
      cssClasses={["ClipboardPopup"]}
      anchor={TOP | RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <box cssClasses={["clipboard-popup-content"]} orientation={Gtk.Orientation.VERTICAL}>
        <box cssClasses={["clipboard-popup-header"]}>
          <label label="󰅍 Clipboard" cssClasses={["popup-title"]} hexpand />
          {countBadgeContainer}
          <button
            cssClasses={["clear-all-btn"]}
            onClicked={() => {
              clearAll()
              GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                refreshClipboard()
                return GLib.SOURCE_REMOVE
              })
            }}
          >
            <label label="Clear All" />
          </button>
        </box>

        {scrolledWindow}
      </box>
    </window>
  ) as Astal.Window

  // Refresh when popup becomes visible
  win.connect("notify::visible", () => {
    if (win.visible) {
      refreshClipboard()
    }
  })

  addEscapeHandler(win)

  return win
}
