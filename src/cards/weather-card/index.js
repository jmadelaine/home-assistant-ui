import {
  AlertCircle,
  Cloud,
  CloudDrops,
  CloudRain,
  CloudSnow,
  CloudSnow2,
  CloudStorm,
  CloudSun2,
  Droplet,
  Fog,
  Gauge,
  Moon,
  MoonCloud,
  Snowflake,
  Sun,
  Umbrella,
  Wind,
} from "../../shared/icons.js";
import { createRoot, css, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete";
const HOUR = 3600e3;

// Met.no reports °C, mm, hPa and m/s; each unit converts from those.
const UNITS = {
  temperature_unit: {
    C: { label: "°C", convert: (c) => c, digits: 0 },
    F: { label: "°F", convert: (c) => (c * 9) / 5 + 32, digits: 0 },
  },
  precipitation_unit: {
    mm: { label: "mm", convert: (mm) => mm, digits: 1 },
    in: { label: "in", convert: (mm) => mm / 25.4, digits: 2 },
  },
  pressure_unit: {
    hPa: { label: "hPa", convert: (p) => p, digits: 0 },
    mbar: { label: "mbar", convert: (p) => p, digits: 0 },
    inHg: { label: "inHg", convert: (p) => p * 0.02953, digits: 2 },
    mmHg: { label: "mmHg", convert: (p) => p * 0.750062, digits: 0 },
  },
  wind_speed_unit: {
    kmph: { label: "km/h", convert: (v) => v * 3.6, digits: 0 },
    mph: { label: "mph", convert: (v) => v * 2.236936, digits: 0 },
    ftps: { label: "ft/s", convert: (v) => v * 3.28084, digits: 0 },
    kn: { label: "kn", convert: (v) => v * 1.943844, digits: 0 },
    mps: { label: "m/s", convert: (v) => v, digits: 1 },
  },
};
const METRIC = { temperature_unit: "C", precipitation_unit: "mm", pressure_unit: "hPa", wind_speed_unit: "kmph" };
const IMPERIAL = { temperature_unit: "F", precipitation_unit: "in", pressure_unit: "inHg", wind_speed_unit: "mph" };

// Conditions use Home Assistant's names, so its translations apply
const ICONS = {
  sunny: Sun,
  "clear-night": Moon,
  partlycloudy: CloudSun2,
  cloudy: Cloud,
  fog: Fog,
  rainy: CloudRain,
  pouring: CloudDrops,
  snowy: CloudSnow,
  "snowy-rainy": CloudSnow2,
  "lightning-rainy": CloudStorm,
  windy: Wind,
};

const LABELS = {
  sunny: "Sunny",
  "clear-night": "Clear",
  partlycloudy: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  rainy: "Rain",
  pouring: "Pouring",
  snowy: "Snow",
  "snowy-rainy": "Sleet",
  "lightning-rainy": "Thunderstorm",
  windy: "Windy",
};

const DRY = new Set(["sunny", "clear-night", "partlycloudy", "cloudy"]);
const WET = new Set(["rainy", "pouring", "lightning-rainy", "snowy", "snowy-rainy"]);
// Met.no has no windy symbol, so a dry hour is windy from a strong breeze (Beaufort 6) up
const STRONG_BREEZE = 10.8; // m/s
// Narrowest column that still fits an hour's temperature and icon
const MIN_HOUR_WIDTH = 26; // px
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const iconFor = (condition, isNight) =>
  condition === "partlycloudy" && isNight ? MoonCloud : (ICONS[condition] ?? AlertCircle);

const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Met.no symbol codes, e.g. "lightrainshowers_day", to Home Assistant conditions
function conditionOf(symbol = "") {
  const [base, period] = symbol.split("_");
  const isNight = period === "night";
  let condition;
  if (base.includes("thunder")) condition = "lightning-rainy";
  else if (base.includes("sleet")) condition = "snowy-rainy";
  else if (base.includes("snow")) condition = "snowy";
  else if (base.startsWith("heavyrain")) condition = "pouring";
  else if (base.includes("rain")) condition = "rainy";
  else if (base === "fog") condition = "fog";
  else if (base === "cloudy") condition = "cloudy";
  else if (base === "fair" || base === "partlycloudy") condition = "partlycloudy";
  else if (base === "clearsky") condition = isNight ? "clear-night" : "sunny";
  return { condition, isNight };
}

// Turns Met.no's timeseries (hourly for ~2 days, then 6-hourly) into hours and days.
function parseMet(json) {
  const entries = (json?.properties?.timeseries ?? []).map((e) => ({
    time: new Date(e.time),
    data: e.data,
  }));

  const hours = [];
  for (const { time, data } of entries) {
    const next = data.next_1_hours;
    if (!next) break;
    const now = data.instant.details;
    const { condition, isNight } = conditionOf(next.summary?.symbol_code);
    hours.push({
      time,
      condition: DRY.has(condition) && now.wind_speed >= STRONG_BREEZE ? "windy" : condition,
      isNight,
      temperature: now.air_temperature,
      humidity: now.relative_humidity,
      pressure: now.air_pressure_at_sea_level,
      windSpeed: now.wind_speed,
      windFrom: now.wind_from_direction,
      rain: next.details?.precipitation_amount ?? 0,
    });
  }

  const days = new Map();
  entries.forEach(({ time, data }, i) => {
    const following = entries[i + 1];
    if (!following) return;
    const span = (following.time - time) / HOUR;
    const key = time.toDateString();
    if (!days.has(key)) {
      days.set(key, { date: time, high: -Infinity, low: Infinity, rain: 0, fromNoon: Infinity });
    }
    const day = days.get(key);

    const temps = [data.instant.details.air_temperature];
    if (span >= 6) {
      temps.push(data.next_6_hours?.details?.air_temperature_max, data.next_6_hours?.details?.air_temperature_min);
    }
    for (const t of temps.filter((t) => typeof t === "number")) {
      day.high = Math.max(day.high, t);
      day.low = Math.min(day.low, t);
    }

    day.rain +=
      span <= 1
        ? (data.next_1_hours?.details?.precipitation_amount ?? 0)
        : ((data.next_6_hours?.details?.precipitation_amount ?? 0) * Math.min(span, 6)) / 6;

    // The day's condition is the one forecast closest to midday
    const symbol = data.next_6_hours?.summary?.symbol_code ?? data.next_1_hours?.summary?.symbol_code;
    const fromNoon = Math.abs(time.getHours() + time.getMinutes() / 60 - 12);
    if (symbol && fromNoon < day.fromNoon) {
      day.fromNoon = fromNoon;
      day.condition = conditionOf(symbol).condition;
    }
  });

  // The last day only has its first few hours, so its numbers would mislead
  return { hours, days: [...days.values()].slice(0, -1) };
}

// The temperature line's vertical range is at least this, so a day that barely
// changes draws nearly flat instead of as a mountain
const MIN_TEMPERATURE_RANGE = 8; // °C

// SVG path through the points that never overshoots them (monotone cubic,
// Fritsch–Carlson), so the curve never shows a temperature that isn't forecast.
function smoothPath(points) {
  const n = points.length;
  if (n < 2) return "";
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0];
    slope[i] = (points[i + 1][1] - points[i][1]) / dx[i];
  }
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] =
      slope[i - 1] * slope[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) /
          ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
  }
  tangent[n - 1] = slope[n - 2];

  const r = (v) => Math.round(v * 100) / 100;
  let d = `M${r(points[0][0])},${r(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    d += `C${r(x0 + h)},${r(y0 + tangent[i] * h)} ${r(x1 - h)},${r(y1 - tangent[i + 1] * h)} ${r(x1)},${r(y1)}`;
  }
  return d;
}

// Finds the first spell of rain, sleet or snow in the coming hours.
function rainSpell(hours) {
  const wet = hours.map((h) => h.rain > 0);
  const start = wet.indexOf(true);
  if (start === -1) return null;
  let end = wet.indexOf(false, start);
  if (end === -1) end = hours.length;
  const spell = hours.slice(start, end);
  return {
    start,
    end,
    kind: spell.some((h) => h.condition === "snowy")
      ? "Snow"
      : spell.some((h) => h.condition === "snowy-rainy")
        ? "Sleet"
        : "Rain",
    total: spell.reduce((sum, h) => sum + h.rain, 0),
  };
}

class WeatherCard extends HTMLElement {
  setConfig(config) {
    for (const key of ["latitude", "longitude", "elevation"]) {
      if (config[key] != null && typeof config[key] !== "number") {
        throw new Error(`${key} must be a number`);
      }
    }
    if ((config.latitude == null) !== (config.longitude == null)) {
      throw new Error("Set both latitude and longitude, or neither to use your home location");
    }
    const units = {};
    for (const [key, options] of Object.entries(UNITS)) {
      if (config[key] == null) continue;
      units[key] = Object.keys(options).find(
        (unit) => unit.toLowerCase() === String(config[key]).toLowerCase(),
      );
      if (!units[key]) {
        throw new Error(`${key} must be one of: ${Object.keys(options).join(", ")}`);
      }
    }

    this.config = { hours: 24, days: 5, ...config, ...units };
    if (!this.shadowRoot) this._build();
    if (this._url() !== this._loadedUrl) this._load();
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.config) return;
    // The first hass brings the home location, used when the config has none
    if (this._url() !== this._loadedUrl) this._load();
    else if (
      !prev ||
      prev.locale !== hass.locale ||
      prev.config !== hass.config ||
      prev.states[this.config.temperature_entity] !== hass.states[this.config.temperature_entity]
    ) {
      this._render();
    }
  }

  connectedCallback() {
    this._load();
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
    this._abort?.abort();
    this._loadedUrl = undefined;
  }

  _url() {
    const c = this.config;
    const home = this._hass?.config ?? {};
    const lat = c.latitude ?? home.latitude;
    const lon = c.longitude ?? home.longitude;
    const elevation = c.elevation ?? home.elevation;
    if (typeof lat !== "number" || typeof lon !== "number") return undefined;
    // Met.no rejects coordinates with more than 4 decimals
    const params = new URLSearchParams({ lat: lat.toFixed(4), lon: lon.toFixed(4) });
    if (typeof elevation === "number") params.set("altitude", Math.round(elevation));
    return `${MET_URL}?${params}`;
  }

  // Fetches the forecast, then again when Met.no says it expires. The browser
  // cache serves repeat requests until then, as Met.no's terms ask.
  async _load() {
    clearTimeout(this._timer);
    const url = this._url();
    if (!this.isConnected || !url) return;
    this._loadedUrl = url;
    this._abort?.abort();
    const abort = (this._abort = new AbortController());

    let wait = 10 * 60e3; // retry after a failure
    try {
      const res = await fetch(url, { signal: abort.signal });
      if (!res.ok) throw new Error(`Met.no answered ${res.status}`);
      this._forecast = parseMet(await res.json());
      this._error = undefined;
      const expires = Date.parse(res.headers.get("Expires"));
      wait = Number.isFinite(expires) ? expires - Date.now() : 30 * 60e3;
    } catch (err) {
      if (abort.signal.aborted) return;
      this._error = err.message;
    }
    this._render();

    // Also redraw on the hour, so "now" moves on even if the data hasn't changed
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 5, 0);
    this._timer = setTimeout(() => this._load(), Math.max(60e3, Math.min(wait, nextHour - Date.now())));
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="now">
          <span class="icon"></span>
          <div>
            <div class="temp"></div>
            <div class="range secondary"></div>
          </div>
          <div class="about">
            <div class="condition"></div>
            <div class="name secondary"></div>
          </div>
        </div>
        <div class="details secondary">
          <span>${icon(Wind)}<span class="wind"></span></span>
          <span>${icon(Gauge)}<span class="pressure"></span></span>
          <span>${icon(Droplet)}<span class="humidity"></span></span>
        </div>
        <div class="headline">
          <span class="icon"></span><span class="text"></span><span class="extra secondary"></span>
        </div>
        <div class="hourly surface">
          <div class="temp-chart">
            <svg class="temp-line" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="temp-fade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="currentColor" stop-opacity="0.16"></stop>
                  <stop offset="1" stop-color="currentColor" stop-opacity="0"></stop>
                </linearGradient>
              </defs>
              <path class="area" fill="url(#temp-fade)"></path>
              <path class="line" vector-effect="non-scaling-stroke"></path>
            </svg>
            <div class="temps"></div>
          </div>
          <div class="conditions"></div>
          <div class="bars"></div>
          <div class="labels secondary"></div>
        </div>
        <div class="days"></div>
      </ha-card>`,
    );
    new ResizeObserver(([entry]) => {
      this._hourlyWidth = entry.contentRect.width;
      this._thinHourly();
    }).observe(root.querySelector(".hourly"));
  }

  // Shows every hour's temperature and icon while the columns are wide enough,
  // otherwise every second or third hour. Times show about four times along the
  // bottom, always under an hour that has a temperature. Rain bars show every hour.
  _thinHourly() {
    const root = this.shadowRoot;
    const labels = root.querySelector(".labels");
    const count = labels.children.length;
    if (!count || !this._hourlyWidth) return;

    const gap = parseFloat(getComputedStyle(labels).columnGap) || 0;
    const column = (this._hourlyWidth - gap * (count - 1)) / count;
    const step = root.querySelector(".temp-chart").hidden ? 1 : Math.ceil(MIN_HOUR_WIDTH / column);
    const labelStep = step * Math.max(1, Math.round(count / 4 / step));

    const thin = (row, every) =>
      [...row.children].forEach((cell, i) => cell.classList.toggle("skip", i % every !== 0));
    root.querySelectorAll(".temps, .conditions").forEach((row) => thin(row, step));
    thin(labels, labelStep);
  }

  _render() {
    const root = this.shadowRoot;
    const hass = this._hass;
    if (!root || !hass) return;

    const c = this.config;
    const $ = (selector) => root.querySelector(selector);
    const lang = hass.locale?.language ?? hass.language;
    const defaults = hass.config?.unit_system?.temperature === "°F" ? IMPERIAL : METRIC;
    const unit = (key) => UNITS[key][c[key] ?? defaults[key]];
    const number = (key, value) => {
      if (typeof value !== "number") return "–";
      const { convert, digits } = unit(key);
      // `+ 0` turns -0 into 0, so a rounded -0.2° shows as 0°
      const rounded = Number(convert(value).toFixed(digits)) + 0;
      return rounded.toLocaleString(lang, { maximumFractionDigits: digits, useGrouping: false });
    };
    const withUnit = (key, value) => `${number(key, value)} ${unit(key).label}`;
    const degrees = (value) => `${number("temperature_unit", value)}°`;
    const time = (date, opts = { minute: "2-digit" }) =>
      date.toLocaleTimeString(lang, { hour: "2-digit", hourCycle: "h23", ...opts });
    const setIcon = (el, Icon) => el.replaceChildren(Icon({ weight: "Outline" }));
    // styles.css colors an element by its data-condition (and data-night)
    const tint = (el, condition, isNight) => {
      if (condition) el.dataset.condition = condition;
      else delete el.dataset.condition;
      el.toggleAttribute("data-night", !!isNight);
    };
    const showCondition = (el, condition, isNight) => {
      setIcon(el, iconFor(condition, isNight));
      tint(el, condition, isNight);
    };

    const now = new Date();
    const thisHour = new Date(now);
    thisHour.setMinutes(0, 0, 0);
    const forecast = this._forecast;
    const current = forecast && (forecast.hours.findLast((h) => h.time <= now) ?? forecast.hours[0]);

    $(".name").textContent = c.name ?? "";
    if (!current) {
      showCondition($(".now .icon"));
      $(".temp").textContent = "";
      $(".range").textContent = "";
      $(".condition").textContent = !this._url()
        ? "Set latitude and longitude"
        : this._error
          ? "Forecast unavailable"
          : "Loading…";
      for (const el of [".details", ".headline", ".hourly", ".days"]) $(el).hidden = true;
      return;
    }

    // Now
    showCondition($(".now .icon"), current.condition, current.isNight);
    const sensor = hass.states[c.temperature_entity];
    let local = parseFloat(sensor?.state);
    if (sensor?.attributes.unit_of_measurement === "°F") local = ((local - 32) * 5) / 9;
    $(".temp").textContent = degrees(Number.isFinite(local) ? local : current.temperature);
    $(".condition").textContent =
      hass.localize?.(`component.weather.entity_component._.state.${current.condition}`) ||
      LABELS[current.condition] ||
      "";
    const today = forecast.days.find((d) => sameDay(d.date, now));
    $(".range").textContent = today ? `H ${degrees(today.high)} · L ${degrees(today.low)}` : "";

    $(".details").hidden = !c.has_details;
    if (c.has_details) {
      const from = COMPASS[Math.round(current.windFrom / 45) % 8] ?? "";
      $(".wind").textContent = `${withUnit("wind_speed_unit", current.windSpeed)} ${from}`;
      $(".pressure").textContent = withUnit("pressure_unit", current.pressure);
      $(".humidity").textContent = `${Math.round(current.humidity)}%`;
    }

    // Rain headline and hourly panel, over the next `hours` hours
    const hours = forecast.hours.filter((h) => h.time >= thisHour).slice(0, c.hours);
    $(".headline").hidden = !hours.length;
    if (hours.length) {
      const spell = rainSpell(hours);
      const span = `${hours.length} hour${hours.length === 1 ? "" : "s"}`;
      let text = `Dry for the next ${span}`;
      let extra = "";
      if (spell) {
        const when =
          spell.start > 0
            ? `from ${time(hours[spell.start].time)}`
            : spell.end < hours.length
              ? `until ${time(hours[spell.end].time)}`
              : `for the next ${span}`;
        text = `${spell.kind} ${when}`;
        extra = withUnit("precipitation_unit", spell.total);
      }
      setIcon($(".headline .icon"), spell && spell.kind !== "Rain" ? Snowflake : Umbrella);
      tint($(".headline .icon"), spell && { Rain: "rainy", Sleet: "snowy-rainy", Snow: "snowy" }[spell.kind]);
      $(".headline").classList.toggle("wet", !!spell);
      $(".headline .text").textContent = text;
      $(".headline .extra").textContent = extra;
    }

    // Hourly panel: the forecast and/or rain bars, sharing one row of times
    const forecastShown = hours.length > 0 && !!c.has_hourly_forecast;
    const rainShown = hours.length > 0 && !!c.has_rain_chart;
    $(".hourly").hidden = !forecastShown && !rainShown;
    $(".temp-chart").hidden = !forecastShown;
    $(".conditions").hidden = !forecastShown;
    $(".bars").hidden = !rainShown;
    const cells = (fill) =>
      hours.map((h) => {
        const cell = document.createElement("span");
        fill(cell, h);
        return cell;
      });

    if (forecastShown) {
      // One column per hour: x is the column's center, y is 0 (coldest) to 1 (warmest)
      const temps = hours.map((h) => h.temperature);
      let low = Math.min(...temps);
      let high = Math.max(...temps);
      if (high - low < MIN_TEMPERATURE_RANGE) {
        const middle = (high + low) / 2;
        low = middle - MIN_TEMPERATURE_RANGE / 2;
        high = middle + MIN_TEMPERATURE_RANGE / 2;
      }
      const level = (t) => (t - low) / (high - low);
      const points = hours.map((h, i) => [i + 0.5, (1 - level(h.temperature)) * 100]);
      const line = smoothPath(points);
      $(".temp-line").setAttribute("viewBox", `0 0 ${hours.length} 100`);
      $(".temp-line .line").setAttribute("d", line);
      $(".temp-line .area").setAttribute(
        "d",
        line && `${line}L${points.at(-1)[0]},100L${points[0][0]},100Z`,
      );

      // Each hour's value sits just above the line; thinning hides some of them
      $(".temps").replaceChildren(
        ...cells((cell, h) => {
          cell.style.setProperty("--level", level(h.temperature));
          cell.title = `${time(h.time)} · ${degrees(h.temperature)}`;
          const value = document.createElement("span");
          value.className = "value";
          value.textContent = degrees(h.temperature);
          cell.append(value);
        }),
      );
      $(".conditions").replaceChildren(
        ...cells((cell, h) => showCondition(cell, h.condition, h.isNight)),
      );
    }

    if (rainShown) {
      // Drizzle shouldn't fill the chart, so the scale is at least a steady shower
      const max = Math.max(2.5, ...hours.map((h) => h.rain));
      $(".bars").replaceChildren(
        ...cells((bar, h) => {
          bar.className = h.rain > 0 ? "bar" : "bar dry";
          if (h.rain > 0 && WET.has(h.condition)) tint(bar, h.condition);
          bar.style.height = `${(h.rain / max) * 100}%`;
          bar.title = `${time(h.time)} · ${withUnit("precipitation_unit", h.rain)}`;
        }),
      );
    }

    if (forecastShown || rainShown) {
      $(".labels").replaceChildren(
        ...cells((label, h) => (label.textContent = h === hours[0] ? "Now" : time(h.time, {}))),
      );
      this._thinHourly();
    }

    // Daily strip
    const days = forecast.days.slice(0, c.days);
    $(".days").hidden = !c.has_daily_forecast || !days.length;
    if (!$(".days").hidden) {
      $(".days").replaceChildren(
        ...days.map((d) => {
          const tile = document.createElement("div");
          tile.className = "day surface";
          tile.innerHTML = `
            <span class="weekday secondary"></span>
            <span class="icon"></span>
            <span class="high"></span>
            <span class="low secondary"></span>
            <span class="wet"></span>`;
          tile.querySelector(".weekday").textContent = sameDay(d.date, now)
            ? "Today"
            : d.date.toLocaleDateString(lang, { weekday: "short" });
          showCondition(tile.querySelector(".icon"), d.condition);
          tile.querySelector(".high").textContent = degrees(d.high);
          tile.querySelector(".low").textContent = degrees(d.low);
          tile.querySelector(".wet").textContent =
            d.rain >= 0.1 ? withUnit("precipitation_unit", d.rain) : "";
          return tile;
        }),
      );
    }
  }

  getCardSize() {
    const c = this.config ?? {};
    return (
      2 +
      (c.has_details ? 1 : 0) +
      (c.has_hourly_forecast || c.has_rain_chart ? 1 : 0) +
      (c.has_daily_forecast ? 2 : 0)
    );
  }
}

registerCard("weather-card", WeatherCard, {
  name: "Weather",
  description: "Met.no forecast: conditions now, when it'll rain next, and the days ahead",
});
