import GLib from "gi://GLib"
import { createPoll } from "ags/time"
import { togglePopup } from "../../lib/popup-manager"
import { LATITUDE, LONGITUDE } from "../../lib/constants"

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

function fetchWeather(lat: number, lon: number): WeatherData | null {
  try {
    // Get weather data
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
    const [ok, stdout] = GLib.spawn_command_line_sync(`curl -s "${weatherUrl}"`)

    if (ok && stdout) {
      const text = new TextDecoder().decode(stdout)
      const data = JSON.parse(text)

      if (data.current) {
        const code = data.current.weather_code
        const info = getWeatherInfo(code)

        // Get city name via reverse geocoding
        let city = "Unknown"
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          const [geoOk, geoStdout] = GLib.spawn_command_line_sync(`curl -s -A "AGS-Weather" "${geoUrl}"`)
          if (geoOk && geoStdout) {
            const geoData = JSON.parse(new TextDecoder().decode(geoStdout))
            city = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.name || "Unknown"
          }
        } catch {
          // ignore geocoding errors
        }

        return {
          temp: Math.round(data.current.temperature_2m),
          code,
          description: info.desc,
          icon: info.icon,
          city,
        }
      }
    }
  } catch {
    // ignore fetch errors
  }
  return null
}

export default function Weather() {
  const weather = createPoll<WeatherData | null>(
    null,
    600000, // 10 minutes
    () => fetchWeather(LATITUDE, LONGITUDE)
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
          label={weather((w) => w ? `${w.temp}°` : "--°")}
        />
      </box>
    </button>
  )
}
