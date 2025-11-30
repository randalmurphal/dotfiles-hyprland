import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { togglePopup } from "../../lib/popup-manager"
import { CLOCK_TIME_POLL_MS, CLOCK_DATE_POLL_MS } from "../../lib/constants/polling"

export default function Clock() {
  const time = createPoll("--:--", CLOCK_TIME_POLL_MS, () => {
    const now = GLib.DateTime.new_now_local()
    return now ? now.format("%I:%M %p") || "--:--" : "--:--"
  })

  const date = createPoll("", CLOCK_DATE_POLL_MS, () => {
    const now = GLib.DateTime.new_now_local()
    return now ? now.format("%a, %b %d") || "" : ""
  })

  return (
    <button
      cssClasses={["clock"]}
      onClicked={() => togglePopup("calendar-popup")}
    >
      <box>
        <label cssClasses={["time"]} label={time} />
        <label cssClasses={["divider"]} label="|" />
        <label cssClasses={["date"]} label={date} />
      </box>
    </button>
  )
}
