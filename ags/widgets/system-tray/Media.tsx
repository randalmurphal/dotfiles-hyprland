import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { togglePopup } from "../../lib/popup-manager"
import { getMediaInfo, hasActivePlayer } from "../popups/media/media-utils"
import { MEDIA_POLL_MS } from "../../lib/constants/polling"

// NOTE: This component is intentionally NOT included in the system tray.
// Media controls are integrated into AudioPopup instead.
// Keeping this file for potential future standalone use.

export default function Media() {
  // Poll media status
  const mediaStatus = createPoll(
    { status: "Stopped" as const, title: "" },
    MEDIA_POLL_MS,
    () => {
      const info = getMediaInfo()
      return { status: info.status, title: info.title }
    }
  )

  // Icons: 󰐊 playing, 󰏤 paused, 󰓛 stopped/no player
  const getIcon = (status: { status: string; title: string }) => {
    if (!status.title || status.status === "Stopped") return "󰓛"
    if (status.status === "Playing") return "󰐊"
    if (status.status === "Paused") return "󰏤"
    return "󰓛"
  }

  const getTooltip = (status: { status: string; title: string }) => {
    if (!status.title || status.status === "Stopped") return "No media playing"
    return `${status.status}: ${status.title}`
  }

  const getClasses = (status: { status: string; title: string }) => {
    const classes = ["systray-btn"]
    if (!status.title || status.status === "Stopped") {
      classes.push("dimmed")
    }
    return classes
  }

  return (
    <button
      cssClasses={mediaStatus(getClasses)}
      tooltipText={mediaStatus(getTooltip)}
      onClicked={() => togglePopup("media-popup")}
    >
      <label cssClasses={["icon"]} label={mediaStatus(getIcon)} />
    </button>
  )
}
