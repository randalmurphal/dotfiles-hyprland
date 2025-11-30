import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { togglePopup } from "../../lib/popup-manager"

interface WeatherData {
  temp: number
  code: number
  description: string
  icon: string
  city: string
}

// WMO Weather codes to icons and descriptions
const weatherCodes: Record<number, { icon: string; desc: string }> = {
  0: { icon: "󰖙", desc: "Clear" },
  1: { icon: "󰖙", desc: "Mainly clear" },
  2: { icon: "󰖐", desc: "Partly cloudy" },
  3: { icon: "󰖐", desc: "Overcast" },
  45: { icon: "󰖑", desc: "Foggy" },
  48: { icon: "󰖑", desc: "Icy fog" },
  51: { icon: "󰖗", desc: "Light drizzle" },
  53: { icon: "󰖗", desc: "Drizzle" },
  55: { icon: "󰖗", desc: "Heavy drizzle" },
  56: { icon: "󰖘", desc: "Freezing drizzle" },
  57: { icon: "󰖘", desc: "Heavy freezing drizzle" },
  61: { icon: "󰖖", desc: "Light rain" },
  63: { icon: "󰖖", desc: "Rain" },
  65: { icon: "󰖖", desc: "Heavy rain" },
  66: { icon: "󰖘", desc: "Freezing rain" },
  67: { icon: "󰖘", desc: "Heavy freezing rain" },
  71: { icon: "󰖘", desc: "Light snow" },
  73: { icon: "󰖘", desc: "Snow" },
  75: { icon: "󰖘", desc: "Heavy snow" },
  77: { icon: "󰖘", desc: "Snow grains" },
  80: { icon: "󰖖", desc: "Light showers" },
  81: { icon: "󰖖", desc: "Showers" },
  82: { icon: "󰖖", desc: "Heavy showers" },
  85: { icon: "󰖘", desc: "Light snow showers" },
  86: { icon: "󰖘", desc: "Snow showers" },
  95: { icon: "󰖓", desc: "Thunderstorm" },
  96: { icon: "󰖓", desc: "Thunderstorm with hail" },
  99: { icon: "󰖓", desc: "Thunderstorm with heavy hail" },
}

function getWeatherInfo(code: number): { icon: string; desc: string } {
  return weatherCodes[code] || { icon: "󰖐", desc: "Unknown" }
}

const CACHE_FILE = `${GLib.get_user_cache_dir()}/ags-weather.json`

// Read weather from systemd-maintained cache file (instant, no network)
function readWeatherCache(): WeatherData | null {
  try {
    const [ok, contents] = GLib.file_get_contents(CACHE_FILE)
    if (ok && contents) {
      const data = JSON.parse(new TextDecoder().decode(contents))
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
    30000,               // Re-read cache every 30s
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
