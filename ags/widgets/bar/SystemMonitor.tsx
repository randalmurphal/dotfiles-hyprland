import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { SYSTEM_MONITOR_POLL_MS } from "../../lib/constants/polling"
import { logError } from "../../lib/logger"
import { spawnSyncOutput } from "../../lib/system-commands"

interface SystemStats {
  cpuPercent: number
  cpuTemp: number
  ramUsedGb: number
  ramTotalGb: number
  gpuPercent: number
  gpuTemp: number
  vramUsedGb: number
  vramTotalGb: number
}

function getSystemStats(): SystemStats {
  const stats: SystemStats = {
    cpuPercent: 0,
    cpuTemp: 0,
    ramUsedGb: 0,
    ramTotalGb: 0,
    gpuPercent: 0,
    gpuTemp: 0,
    vramUsedGb: 0,
    vramTotalGb: 0,
  }

  // CPU usage from /proc/stat
  try {
    const [ok, contents] = GLib.file_get_contents("/proc/stat")
    if (ok && contents) {
      const text = new TextDecoder().decode(contents)
      const line = text.split("\n")[0]
      const parts = line.split(/\s+/).slice(1).map(Number)
      const idle = parts[3]
      const total = parts.reduce((a, b) => a + b, 0)
      const busy = total - idle
      stats.cpuPercent = Math.round((busy / total) * 100)
    }
  } catch (e) {
    logError("SystemMonitor:CPU", e)
  }

  // RAM from /proc/meminfo
  try {
    const [ok, contents] = GLib.file_get_contents("/proc/meminfo")
    if (ok && contents) {
      const text = new TextDecoder().decode(contents)
      const lines = text.split("\n")
      let totalKb = 0
      let availableKb = 0
      for (const line of lines) {
        if (line.startsWith("MemTotal:")) {
          totalKb = parseInt(line.split(/\s+/)[1])
        } else if (line.startsWith("MemAvailable:")) {
          availableKb = parseInt(line.split(/\s+/)[1])
        }
      }
      if (totalKb > 0) {
        stats.ramTotalGb = Math.round(totalKb / 1024 / 1024)
        stats.ramUsedGb = Math.round((totalKb - availableKb) / 1024 / 1024 * 10) / 10
      }
    }
  } catch (e) {
    logError("SystemMonitor:RAM", e)
  }

  // CPU temp from /sys/class/hwmon
  try {
    const paths = [
      "/sys/class/hwmon/hwmon0/temp1_input",
      "/sys/class/hwmon/hwmon1/temp1_input",
      "/sys/class/hwmon/hwmon2/temp1_input",
      "/sys/class/thermal/thermal_zone0/temp",
    ]
    for (const path of paths) {
      try {
        const [ok, contents] = GLib.file_get_contents(path)
        if (ok && contents) {
          const temp = parseInt(new TextDecoder().decode(contents))
          stats.cpuTemp = Math.round(temp / 1000)
          break
        }
      } catch {
        // try next path
      }
    }
  } catch (e) {
    logError("SystemMonitor:CPUTemp", e)
  }

  // NVIDIA GPU stats via nvidia-smi
  try {
    const result = spawnSyncOutput(
      "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits",
      "SystemMonitor:nvidia-smi"
    )
    if (result.ok) {
      const parts = result.output.split(",").map((s) => s.trim())
      if (parts.length >= 4) {
        stats.gpuPercent = parseInt(parts[0]) || 0
        const vramUsedMb = parseInt(parts[1]) || 0
        const vramTotalMb = parseInt(parts[2]) || 1
        stats.vramUsedGb = Math.round(vramUsedMb / 1024 * 10) / 10
        stats.vramTotalGb = Math.round(vramTotalMb / 1024)
        stats.gpuTemp = parseInt(parts[3]) || 0
      }
    }
  } catch (e) {
    logError("SystemMonitor:GPU", e)
  }

  return stats
}

export default function SystemMonitor() {
  const stats = createPoll<SystemStats>(
    { cpuPercent: 0, cpuTemp: 0, ramUsedGb: 0, ramTotalGb: 0, gpuPercent: 0, gpuTemp: 0, vramUsedGb: 0, vramTotalGb: 0 },
    SYSTEM_MONITOR_POLL_MS,
    getSystemStats
  )

  return (
    <box cssClasses={["system-monitor"]}>
      <box cssClasses={["stat-item"]}>
        <label cssClasses={["stat-label"]} label="CPU" />
        <label
          cssClasses={["stat-value"]}
          label={stats((s) => `${s.cpuPercent}%`)}
        />
        <label
          cssClasses={["stat-temp"]}
          label={stats((s) => (s.cpuTemp > 0 ? `${s.cpuTemp}°` : ""))}
        />
      </box>
      <label cssClasses={["stat-separator"]} label="|" />
      <box cssClasses={["stat-item"]}>
        <label cssClasses={["stat-label"]} label="RAM" />
        <label
          cssClasses={["stat-value"]}
          label={stats((s) => `${s.ramUsedGb}/${s.ramTotalGb}G`)}
        />
      </box>
      <label cssClasses={["stat-separator"]} label="|" />
      <box cssClasses={["stat-item"]}>
        <label cssClasses={["stat-label"]} label="GPU" />
        <label
          cssClasses={["stat-value"]}
          label={stats((s) => `${s.gpuPercent}%`)}
        />
        <label
          cssClasses={["stat-temp"]}
          label={stats((s) => (s.gpuTemp > 0 ? `${s.gpuTemp}°` : ""))}
        />
      </box>
      <label cssClasses={["stat-separator"]} label="|" />
      <box cssClasses={["stat-item"]}>
        <label cssClasses={["stat-label"]} label="VRAM" />
        <label
          cssClasses={["stat-value"]}
          label={stats((s) => `${s.vramUsedGb}/${s.vramTotalGb}G`)}
        />
      </box>
    </box>
  )
}
