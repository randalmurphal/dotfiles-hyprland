import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import { closeAllPopups } from "../../../lib/popup-manager"

const CACHE_FILE = `${GLib.get_user_cache_dir()}/ags-weather.json`

interface HourlyForecast {
  time: string
  hour: string
  temp: number
  icon: string
}

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
  hourly: HourlyForecast[]
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

// Store custom location state
let customLocationName = ""
let isUsingCurrentLocation = true

function formatHour(timeStr: string): string {
  const date = new Date(timeStr)
  const now = new Date()
  if (date.getHours() === now.getHours() && date.getDate() === now.getDate()) {
    return "Now"
  }
  return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })
}

// Read weather details from systemd-maintained cache (instant, no network)
function readWeatherFromCache(): { details: WeatherDetails | null; location: string } {
  try {
    const [ok, contents] = GLib.file_get_contents(CACHE_FILE)
    if (ok && contents) {
      const cache = JSON.parse(new TextDecoder().decode(contents))
      if (cache.weather?.current && cache.weather?.daily) {
        const code = cache.weather.current.weather_code
        const info = getWeatherInfo(code)

        // Parse hourly data (next 5 hours starting from current)
        const hourly: HourlyForecast[] = []
        if (cache.weather.hourly?.time) {
          const now = new Date()
          const currentHour = now.getHours()
          let count = 0
          for (let i = 0; i < cache.weather.hourly.time.length && count < 5; i++) {
            const hourTime = new Date(cache.weather.hourly.time[i])
            if (hourTime >= now || (hourTime.getDate() === now.getDate() && hourTime.getHours() >= currentHour)) {
              const hourCode = cache.weather.hourly.weather_code[i]
              const hourInfo = getWeatherInfo(hourCode)
              hourly.push({
                time: cache.weather.hourly.time[i],
                hour: formatHour(cache.weather.hourly.time[i]),
                temp: Math.round(cache.weather.hourly.temperature_2m[i]),
                icon: hourInfo.icon,
              })
              count++
            }
          }
        }

        const forecast: ForecastDay[] = cache.weather.daily.time.map(
          (date: string, i: number) => {
            const dayCode = cache.weather.daily.weather_code[i]
            const dayInfo = getWeatherInfo(dayCode)
            return {
              date,
              dayName: getDayName(date),
              high: Math.round(cache.weather.daily.temperature_2m_max[i]),
              low: Math.round(cache.weather.daily.temperature_2m_min[i]),
              code: dayCode,
              icon: dayInfo.icon,
            }
          }
        )

        return {
          details: {
            temp: Math.round(cache.weather.current.temperature_2m),
            feelsLike: Math.round(cache.weather.current.apparent_temperature),
            humidity: cache.weather.current.relative_humidity_2m,
            windSpeed: Math.round(cache.weather.current.wind_speed_10m),
            description: info.desc,
            icon: info.icon,
            hourly,
            forecast,
          },
          location: cache.location || "Unknown",
        }
      }
    }
  } catch {
    // Cache not ready
  }
  return { details: null, location: "Unknown" }
}

// Fetch weather for a searched location (only used for non-current locations)
function fetchWeatherForLocation(lat: number, lon: number): WeatherDetails | null {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=5&forecast_hours=6`

    const [ok, stdout] = GLib.spawn_command_line_sync(`curl -s "${url}"`)

    if (ok && stdout) {
      const text = new TextDecoder().decode(stdout)
      const data = JSON.parse(text)

      if (data.current && data.daily) {
        const code = data.current.weather_code
        const info = getWeatherInfo(code)

        // Parse hourly data
        const hourly: HourlyForecast[] = []
        if (data.hourly?.time) {
          const now = new Date()
          const currentHour = now.getHours()
          let count = 0
          for (let i = 0; i < data.hourly.time.length && count < 5; i++) {
            const hourTime = new Date(data.hourly.time[i])
            if (hourTime >= now || (hourTime.getDate() === now.getDate() && hourTime.getHours() >= currentHour)) {
              const hourCode = data.hourly.weather_code[i]
              const hourInfo = getWeatherInfo(hourCode)
              hourly.push({
                time: data.hourly.time[i],
                hour: formatHour(data.hourly.time[i]),
                temp: Math.round(data.hourly.temperature_2m[i]),
                icon: hourInfo.icon,
              })
              count++
            }
          }
        }

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
          hourly,
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
        return data.results.map((r: { name: string; admin1?: string; country: string; latitude: number; longitude: number; postcode?: string }) => {
          // Format: "City, State ZIP" (no country)
          let name = r.name
          if (r.admin1) name += `, ${r.admin1}`
          if (r.postcode) name += ` ${r.postcode}`
          return { name, lat: r.latitude, lon: r.longitude }
        })
      }
    }
  } catch {
    // ignore
  }
  return []
}

// Fetch full location name with zip via Nominatim reverse geocoding
function getFullLocationName(lat: number, lon: number): string {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    const [ok, stdout] = GLib.spawn_command_line_sync(`curl -s -A "AGS-Weather" "${url}"`)

    if (ok && stdout) {
      const text = new TextDecoder().decode(stdout)
      const data = JSON.parse(text)

      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.name || "Unknown"
        const state = data.address.state || ""
        const zip = data.address.postcode || ""

        let location = city
        if (state) location += `, ${state}`
        if (zip) location += ` ${zip}`
        return location
      }
    }
  } catch {
    // ignore
  }
  return ""
}

// Track selected location for searched locations
let selectedLocation: { lat: number; lon: number } | null = null
// Track if the currently displayed location is the saved default
let isDefaultLocation = true

const CONFIG_FILE = `${GLib.get_user_config_dir()}/ags/weather.conf`

// Read saved default location from config
function getSavedLocation(): { lat: number; lon: number } | null {
  try {
    const [ok, contents] = GLib.file_get_contents(CONFIG_FILE)
    if (ok && contents) {
      const text = new TextDecoder().decode(contents)
      const latMatch = text.match(/LAT=([\d.-]+)/)
      const lonMatch = text.match(/LON=([\d.-]+)/)
      if (latMatch && lonMatch) {
        return { lat: parseFloat(latMatch[1]), lon: parseFloat(lonMatch[1]) }
      }
    }
  } catch {
    // ignore
  }
  return null
}

// Save location to config file (persists for systemd service)
function saveLocationToConfig(lat: number, lon: number): void {
  try {
    const content = `# AGS Weather Configuration\n# Set via weather popup search\nLAT=${lat}\nLON=${lon}\n`
    GLib.file_set_contents(CONFIG_FILE, content)
    // Trigger systemd service to update cache with new location
    GLib.spawn_command_line_async("systemctl --user start ags-weather.service")
  } catch {
    // ignore
  }
}

// Clear default location (remove config file)
function clearDefaultLocation(): void {
  try {
    GLib.unlink(CONFIG_FILE)
  } catch {
    // ignore
  }
}

export default function WeatherPopup() {
  let weatherData: WeatherDetails | null = null
  let searchResults: Array<{ name: string; lat: number; lon: number }> = []
  let searchTimer: number | null = null

  // UI references
  let winRef: Astal.Window | null = null
  let titleLabel: Gtk.Label
  let subtitleLabel: Gtk.Label
  let starBtn: Gtk.Button
  let starIcon: Gtk.Label
  let searchEntry: Gtk.Entry
  let resultsBox: Gtk.Box
  let currentWeatherBox: Gtk.Box
  let hourlyBox: Gtk.Box
  let forecastBox: Gtk.Box

  // Helper: Force window to recalculate size (needed for layer shell windows)
  function triggerWindowResize() {
    if (winRef) winRef.set_default_size(-1, -1)
  }

  function updateWeatherDisplay() {
    if (!weatherData) return

    // Update title and subtitle
    titleLabel.label = customLocationName
    subtitleLabel.label = "Default Location"
    subtitleLabel.visible = isDefaultLocation
    // Update star icon (filled if default, empty if not)
    starIcon.label = isDefaultLocation ? "★" : "☆"

    // Clear current weather box
    let child = currentWeatherBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      currentWeatherBox.remove(child)
      child = next
    }

    // Build current weather
    const weatherMain = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
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

    // Clear and rebuild hourly forecast
    child = hourlyBox.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      hourlyBox.remove(child)
      child = next
    }

    if (weatherData.hourly && weatherData.hourly.length > 0) {
      const hourlyList = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, homogeneous: true })
      hourlyList.add_css_class("hourly-list")

      for (const hour of weatherData.hourly) {
        const hourBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER })
        hourBox.add_css_class("hourly-item")

        const hourLabel = new Gtk.Label({ label: hour.hour })
        hourLabel.add_css_class("hourly-time")

        const hourIcon = new Gtk.Label({ label: hour.icon })
        hourIcon.add_css_class("hourly-icon")

        const tempLabel = new Gtk.Label({ label: `${hour.temp}°` })
        tempLabel.add_css_class("hourly-temp")

        hourBox.append(hourLabel)
        hourBox.append(hourIcon)
        hourBox.append(tempLabel)
        hourlyList.append(hourBox)
      }

      hourlyBox.append(hourlyList)
    }

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
        selectedLocation = { lat: result.lat, lon: result.lon }
        // Get full location name with zip immediately via Nominatim
        const fullName = getFullLocationName(result.lat, result.lon)
        customLocationName = fullName || result.name
        isUsingCurrentLocation = false
        // Check if this matches the saved default location
        const saved = getSavedLocation()
        isDefaultLocation = saved !== null &&
          Math.abs(saved.lat - result.lat) < 0.001 &&
          Math.abs(saved.lon - result.lon) < 0.001
        searchResults = []
        updateSearchResults()
        searchEntry.text = ""
        // Fetch weather data
        weatherData = fetchWeatherForLocation(result.lat, result.lon)
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

  // Star button to toggle default location
  starBtn = new Gtk.Button()
  starBtn.add_css_class("star-btn")
  starIcon = new Gtk.Label({ label: isDefaultLocation ? "★" : "☆" })
  starBtn.set_child(starIcon)
  starBtn.connect("clicked", () => {
    if (isDefaultLocation) {
      // Unset as default
      clearDefaultLocation()
      isDefaultLocation = false
    } else if (selectedLocation) {
      // Set current location as default
      saveLocationToConfig(selectedLocation.lat, selectedLocation.lon)
      isDefaultLocation = true
    }
    updateWeatherDisplay()
  })

  // Title box with location name and "Default Location" subtitle
  const titleBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true, halign: Gtk.Align.START })

  titleLabel = new Gtk.Label({ label: customLocationName, halign: Gtk.Align.START })
  titleLabel.add_css_class("popup-title")

  subtitleLabel = new Gtk.Label({ label: "Default Location", halign: Gtk.Align.START, visible: isDefaultLocation })
  subtitleLabel.add_css_class("location-subtitle")

  titleBox.append(titleLabel)
  titleBox.append(subtitleLabel)

  // Helper to load weather (cache for current, network for searched)
  function loadWeather() {
    if (isUsingCurrentLocation) {
      const cached = readWeatherFromCache()
      weatherData = cached.details
      customLocationName = cached.location
      // Check if this is the default location
      isDefaultLocation = true
      selectedLocation = getSavedLocation()
    } else if (selectedLocation) {
      weatherData = fetchWeatherForLocation(selectedLocation.lat, selectedLocation.lon)
    }
    updateWeatherDisplay()
  }

  const refreshBtn = new Gtk.Button()
  refreshBtn.add_css_class("refresh-btn")
  const refreshIcon = new Gtk.Label({ label: "󰑓" })
  refreshBtn.set_child(refreshIcon)
  refreshBtn.connect("clicked", () => {
    loadWeather()
  })

  header.append(starBtn)
  header.append(titleBox)
  header.append(refreshBtn)

  // Search section
  const searchSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  searchSection.add_css_class("search-section")

  // Search box with magnifying glass icon
  const searchBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 })
  searchBox.add_css_class("search-box")

  const searchIcon = new Gtk.Label({ label: "" })
  searchIcon.add_css_class("search-icon")

  searchEntry = new Gtk.Entry({ hexpand: true, placeholderText: "Search location..." })
  searchEntry.add_css_class("search-entry")
  searchEntry.connect("changed", onSearchChanged)

  searchBox.append(searchIcon)
  searchBox.append(searchEntry)

  resultsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, visible: false })
  resultsBox.add_css_class("search-results")

  searchSection.append(searchBox)
  searchSection.append(resultsBox)

  // Current weather
  currentWeatherBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  // Hourly forecast section
  const hourlySection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  hourlySection.add_css_class("hourly-section")

  const hourlyTitle = new Gtk.Label({ label: "NEXT 5 HOURS", halign: Gtk.Align.START })
  hourlyTitle.add_css_class("section-title")

  hourlyBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  hourlySection.append(hourlyTitle)
  hourlySection.append(hourlyBox)

  // Daily forecast section
  const forecastSection = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  forecastSection.add_css_class("forecast-section")

  const forecastTitle = new Gtk.Label({ label: "5-DAY FORECAST", halign: Gtk.Align.START })
  forecastTitle.add_css_class("section-title")

  forecastBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  forecastSection.append(forecastTitle)
  forecastSection.append(forecastBox)

  // Assemble - search at top, then header/location, then weather
  content.append(searchSection)
  content.append(header)
  content.append(currentWeatherBox)
  content.append(hourlySection)
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
      loadWeather()
    }
  })

  // Initialize from cache (instant, no network)
  const cached = readWeatherFromCache()
  weatherData = cached.details
  customLocationName = cached.location
  GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
    updateWeatherDisplay()
    return GLib.SOURCE_REMOVE
  })

  return win
}
