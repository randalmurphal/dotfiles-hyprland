import Audio from "./Audio"
import Brightness from "./Brightness"
import Bluetooth from "./Bluetooth"
import Caffeine from "./Caffeine"
import Clipboard from "./Clipboard"
import Power from "./Power"
import Notifications from "./Notifications"

export default function SystemTray() {
  return (
    <box cssClasses={["systray"]}>
      <Notifications />
      <Clipboard />
      <Caffeine />
      <Audio />
      <Brightness />
      <Bluetooth />
      <Power />
    </box>
  )
}
