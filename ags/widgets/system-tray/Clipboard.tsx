import { togglePopup } from "../../lib/popup-manager"

export default function Clipboard() {
  return (
    <button
      cssClasses={["systray-btn"]}
      tooltipText="Clipboard History"
      onClicked={() => togglePopup("clipboard-popup")}
    >
      <label cssClasses={["icon"]} label="󰅍" />
    </button>
  )
}
