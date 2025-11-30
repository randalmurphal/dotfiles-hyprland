import { createPoll } from "ags/time"
import { togglePopup } from "../../lib/popup-manager"
import { getWeatherInfo } from "../../lib/weather-codes"
import { getCacheDir } from "../../lib/system-commands"
import { WEATHER_CACHE_POLL_MS } from "../../lib/constants/polling"
import { readFileSync } from "../../lib/system-commands"

interface WeatherData {
  temp: number
  code: number
  description: string
  icon: string
  city: string
}

const CACHE_FILE = `${getCacheDir()}/ags-weather.json`

// Read weather from systemd-maintained cache file (instant, no network)
function readWeatherCache(): WeatherData | null {
  try {
    const contents = readFileSync(CACHE_FILE, "Weather.readCache")
    if (contents) {
      const data = JSON.parse(contents)
      if (data.weather?.current) {
        const code = data.weather.current.weather_code
        const info = getWeatherInfo(code)
        return {
          temp: Math.round(data.weather.current.temperature_2m),
          code,
          description: info.desc,
          icon: info.icon,
          city: data.location || "Unknown",
        }
      }
    }
  } catch {
    // Cache not ready yet
  }
  return null
}

export default function Weather() {
  // Poll cache file every 30 seconds (instant read, systemd updates it every 10 min)
  const weather = createPoll<WeatherData | null>(
    readWeatherCache(),  // Initial read
    WEATHER_CACHE_POLL_MS,
    readWeatherCache
  )

  return (
    <button
      cssClasses={["weather"]}
      onClicked={() => togglePopup("weather-popup")}
      tooltipText={weather((w) => w ? `${w.city}: ${w.description}, ${w.temp}°F` : "Loading weather...")}
    >
      <box>
        <label
          cssClasses={["weather-icon"]}
          label={weather((w) => w?.icon || "󰖐")}
        />
        <label
          cssClasses={["weather-temp"]}
          label={weather((w) => w ? `${w.temp}°F` : "--°")}
        />
      </box>
    </button>
  )
}
