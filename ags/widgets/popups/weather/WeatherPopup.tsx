import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import { closeAllPopups } from "../../../lib/popup-manager"
import { LATITUDE, LONGITUDE } from "../../../lib/constants"

interface ForecastDay {
  date: string
  dayName: string
  high: number
  low: number
  code: number
  icon: string
}

interface WeatherDetails {
  temp: number
  feelsLike: number
  humidity: number
  windSpeed: number
  description: string
  icon: string
  forecast: ForecastDay[]
}

// WMO Weather codes to icons
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

function getDayName(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"

  return date.toLocaleDateString("en-US", { weekday: "short" })
}

// Store custom location
let customLat = LATITUDE
let customLon = LONGITUDE
let customLocationName = "Current Location"

function fetchWeatherDetails(): WeatherDetails | null {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${customLat}&longitude=${customLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5`

    const [ok, stdout] = GLib.spawn_command_line_sync(`curl -s "${url}"`)

    if (ok && stdout) {
      const text = new TextDecoder().decode(stdout)
      const data = JSON.parse(text)

      if (data.current && data.daily) {
        const code = data.current.weather_code
        const info = getWeatherInfo(code)

        const forecast: ForecastDay[] = data.daily.time.map(
          (date: string, i: number) => {
            const dayCode = data.daily.weather_code[i]
            const dayInfo = getWeatherInfo(dayCode)
            return {
              date,
              dayName: getDayName(date),
              high: Math.round(data.daily.temperature_2m_max[i]),
              low: Math.round(data.daily.temperature_2m_min[i]),
              code: dayCode,
              icon: dayInfo.icon,
            }
          }
        )

        return {
          temp: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          description: info.desc,
          icon: info.icon,
          forecast,
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

function searchLocation(query: string): Array<{ name: string; lat: number; lon: number }> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    const [ok, stdout] = GLib.spawn_command_line_sync(`curl -s "${url}"`)

    if (ok && stdout) {
      const text = new TextDecoder().decode(stdout)
      const data = JSON.parse(text)

      if (data.results) {
        return data.results.map((r: { name: string; admin1?: string; country: string; latitude: number; longitude: number }) => ({
          name: `${r.name}${r.admin1 ? ", " + r.admin1 : ""}, ${r.country}`,
          lat: r.latitude,
          lon: r.longitude,
        }))
      }
    }
  } catch {
    // ignore
  }
  return []
}

export default function WeatherPopup() {
  let weatherData: WeatherDetails | null = null
  let searchResults: Array<{ name: string; lat: number; lon: number }> = []
  let searchTimer: number | null = null

  // UI references
  let winRef: Astal.Window | null = null
  let titleLabel: Gtk.Label
  let searchEntry: Gtk.Entry
  let resultsBox: Gtk.Box
  let currentWeatherBox: Gtk.Box
  let forecastBox: Gtk.Box

  // Helper: Force window to recalculate size (needed for layer shell windows)
  function triggerWindowResize() {
    if (winRef) winRef.set_default_size(-1, -1)
  }

  function updateWeatherDisplay() {
    if (!weatherData) return

    // Update title
    titleLabel.label = customLocationName

    // Clear current weather box
    let child = currentWeatherBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      currentWeatherBox.remove(child)
      child = next
    }

    // Build current weather
    const weatherMain = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
    weatherMain.add_css_class("weather-main")

    const iconLabel = new Gtk.Label({ label: weatherData.icon })
    iconLabel.add_css_class("current-icon")

    const infoBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    const tempLabel = new Gtk.Label({ label: `${weatherData.temp}°F`, halign: Gtk.Align.START })
    tempLabel.add_css_class("current-temp")
    const descLabel = new Gtk.Label({ label: weatherData.description, halign: Gtk.Align.START })
    descLabel.add_css_class("current-desc")
    infoBox.append(tempLabel)
    infoBox.append(descLabel)

    weatherMain.append(iconLabel)
    weatherMain.append(infoBox)

    // Details row
    const detailsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, homogeneous: true })
    detailsBox.add_css_class("weather-details")

    const details = [
      { icon: "󰔏", value: `${weatherData.feelsLike}°`, label: "Feels like" },
      { icon: "󰖎", value: `${weatherData.humidity}%`, label: "Humidity" },
      { icon: "󰖝", value: `${weatherData.windSpeed}`, label: "mph" },
    ]

    for (const detail of details) {
      const item = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER })
      item.add_css_class("detail-item")

      const icon = new Gtk.Label({ label: detail.icon })
      icon.add_css_class("detail-icon")
      const value = new Gtk.Label({ label: detail.value })
      value.add_css_class("detail-value")
      const label = new Gtk.Label({ label: detail.label })
      label.add_css_class("detail-label")

      item.append(icon)
      item.append(value)
      item.append(label)
      detailsBox.append(item)
    }

    const currentContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
    currentContainer.add_css_class("current-weather")
    currentContainer.append(weatherMain)
    currentContainer.append(detailsBox)
    currentWeatherBox.append(currentContainer)

    // Clear and rebuild forecast
    child = forecastBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      forecastBox.remove(child)
      child = next
    }

    const forecastList = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, homogeneous: true })
    forecastList.add_css_class("forecast-list")

    for (const day of weatherData.forecast) {
      const dayBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER })
      dayBox.add_css_class("forecast-day")

      const dayName = new Gtk.Label({ label: day.dayName })
      dayName.add_css_class("forecast-day-name")

      const dayIcon = new Gtk.Label({ label: day.icon })
      dayIcon.add_css_class("forecast-icon")

      const tempsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, halign: Gtk.Align.CENTER, spacing: 4 })
      tempsBox.add_css_class("forecast-temps")

      const highLabel = new Gtk.Label({ label: `${day.high}°` })
      highLabel.add_css_class("forecast-high")
      const lowLabel = new Gtk.Label({ label: `${day.low}°` })
      lowLabel.add_css_class("forecast-low")

      tempsBox.append(highLabel)
      tempsBox.append(lowLabel)

      dayBox.append(dayName)
      dayBox.append(dayIcon)
      dayBox.append(tempsBox)
      forecastList.append(dayBox)
    }

    forecastBox.append(forecastList)
  }

  function updateSearchResults() {
    let child = resultsBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      resultsBox.remove(child)
      child = next
    }

    if (searchResults.length === 0) {
      resultsBox.visible = false
      triggerWindowResize()
      return
    }

    resultsBox.visible = true
    triggerWindowResize()

    for (const result of searchResults) {
      const btn = new Gtk.Button()
      btn.add_css_class("search-result")

      const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
      const icon = new Gtk.Label({ label: "󰍎" })
      icon.add_css_class("result-icon")
      const name = new Gtk.Label({ label: result.name, hexpand: true, halign: Gtk.Align.START, ellipsize: 3 })
      name.add_css_class("result-name")

      box.append(icon)
      box.append(name)
      btn.set_child(box)

      btn.connect("clicked", () => {
        customLat = result.lat
        customLon = result.lon
        customLocationName = result.name
        searchResults = []
        updateSearchResults()
        searchEntry.text = ""
        weatherData = fetchWeatherDetails()
        updateWeatherDisplay()
      })

      resultsBox.append(btn)
    }
  }

  function onSearchChanged() {
    const query = searchEntry.text.trim()

    if (searchTimer) {
      GLib.source_remove(searchTimer)
      searchTimer = null
    }

    if (query.length < 2) {
      searchResults = []
      updateSearchResults()
      return
    }

    searchTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      searchResults = searchLocation(query)
      updateSearchResults()
      searchTimer = null
      return GLib.SOURCE_REMOVE
    })
  }

  // Build the popup window
  const win = new Astal.Window({
    name: "weather-popup",
    namespace: "ags-weather-popup",
    application: app,
    anchor: Astal.WindowAnchor.TOP,
    exclusivity: Astal.Exclusivity.IGNORE,
    layer: Astal.Layer.OVERLAY,
    keymode: Astal.Keymode.ON_DEMAND,
    visible: false,
  })
  win.add_css_class("WeatherPopup")
  winRef = win

  const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  content.add_css_class("weather-popup-content")

  // Header
  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
  header.add_css_class("weather-header")

  titleLabel = new Gtk.Label({ label: customLocationName, hexpand: true, halign: Gtk.Align.START })
  titleLabel.add_css_class("popup-title")

  const refreshBtn = new Gtk.Button()
  refreshBtn.add_css_class("refresh-btn")
  const refreshIcon = new Gtk.Label({ label: "󰑓" })
  refreshBtn.set_child(refreshIcon)
  refreshBtn.connect("clicked", () => {
    weatherData = fetchWeatherDetails()
    updateWeatherDisplay()
  })

  header.append(titleLabel)
  header.append(refreshBtn)

  // Search section
  const searchSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  searchSection.add_css_class("search-section")

  searchEntry = new Gtk.Entry({ hexpand: true, placeholderText: "Search location..." })
  searchEntry.add_css_class("search-entry")
  searchEntry.connect("changed", onSearchChanged)

  resultsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, visible: false })
  resultsBox.add_css_class("search-results")

  searchSection.append(searchEntry)
  searchSection.append(resultsBox)

  // Current weather
  currentWeatherBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  // Forecast section
  const forecastSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  forecastSection.add_css_class("forecast-section")

  const forecastTitle = new Gtk.Label({ label: "5-DAY FORECAST", halign: Gtk.Align.START })
  forecastTitle.add_css_class("section-title")

  forecastBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  forecastSection.append(forecastTitle)
  forecastSection.append(forecastBox)

  // Assemble
  content.append(header)
  content.append(searchSection)
  content.append(currentWeatherBox)
  content.append(forecastSection)

  win.set_child(content)

  // Escape key handler
  const keyController = new Gtk.EventControllerKey()
  keyController.connect("key-pressed", (_: Gtk.EventControllerKey, keyval: number) => {
    if (keyval === 65307) {
      closeAllPopups()
      return true
    }
    return false
  })
  win.add_controller(keyController)

  // Refresh on show
  win.connect("notify::visible", () => {
    if (win.visible) {
      weatherData = fetchWeatherDetails()
      updateWeatherDisplay()
    }
  })

  // Initial fetch
  weatherData = fetchWeatherDetails()
  GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    updateWeatherDisplay()
    return GLib.SOURCE_REMOVE
  })

  return win
}
