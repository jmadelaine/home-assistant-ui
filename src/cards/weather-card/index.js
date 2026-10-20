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
import { smoothPath } from "../../shared/chart.js";
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

const windy = (condition, windSpeed) => (DRY.has(condition) && windSpeed >= STRONG_BREEZE ? "windy" : condition);

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

// Turns Met.no's timeseries (hourly for ~2 days, then 6-hourly) into steps and days.
function parseMet(json) {
  const entries = json?.properties?.timeseries ?? [];

  const steps = [];
  entries.forEach(({ time, data }, i) => {
    const following = entries[i + 1];
    if (!following) return;
    const start = new Date(time);
    const span = (new Date(following.time) - start) / HOUR;
    const hourly = span <= 1;
    const next = hourly ? data.next_1_hours : data.next_6_hours;
    const now = data.instant.details;
    const { condition, isNight } = conditionOf(next?.summary?.symbol_code);
    const amount = next?.details?.precipitation_amount ?? 0;
    steps.push({
      time: start,
      span,
      condition: windy(condition, now.wind_speed),
      isNight,
      // The next 6 hours' weather, for the day's condition and 6-hourly days
      outlook: conditionOf(data.next_6_hours?.summary?.symbol_code ?? next?.summary?.symbol_code),
      temperature: now.air_temperature,
      max: hourly ? undefined : next?.details?.air_temperature_max,
      min: hourly ? undefined : next?.details?.air_temperature_min,
      humidity: now.relative_humidity,
      pressure: now.air_pressure_at_sea_level,
      windSpeed: now.wind_speed,
      windFrom: now.wind_from_direction,
      rain: hourly ? amount : (amount * Math.min(span, 6)) / 6,
    });
  });

  const days = new Map();
  for (const step of steps) {
    const key = step.time.toDateString();
    if (!days.has(key)) {
      days.set(key, { key, date: step.time, high: -Infinity, low: Infinity, rain: 0, fromNoon: Infinity, steps: [] });
    }
    const day = days.get(key);
    day.steps.push(step);

    for (const t of [step.temperature, step.max, step.min].filter((t) => typeof t === "number")) {
      day.high = Math.max(day.high, t);
      day.low = Math.min(day.low, t);
    }
    day.rain += step.rain;

    // The day's condition is the one forecast closest to midday
    const fromNoon = Math.abs(step.time.getHours() + step.time.getMinutes() / 60 - 12);
    if (step.outlook.condition && fromNoon < day.fromNoon) {
      day.fromNoon = fromNoon;
      day.condition = step.outlook.condition;
    }
  }

  // The last day only has its first few hours, so its numbers would mislead
  const complete = [...days.values()].slice(0, -1);
  for (const day of complete) day.steps = evenSteps(day.steps);
  return { steps, days: complete };
}

// A day's steps, made even so its chart has equal columns: hourly while Met.no
// is, otherwise 6-hourly, adding up the rain of any hours in each 6.
function evenSteps(steps) {
  if (steps.every((s) => s.span === 1)) return steps;
  const sixes = new Map();
  for (const s of steps) {
    // Met.no's 6-hourly steps start at 00, 06, 12 and 18 UTC
    const key = Math.floor(s.time / (6 * HOUR));
    const six = sixes.get(key);
    if (six) six.rain += s.rain;
    else {
      const { condition, isNight } = s.outlook;
      sixes.set(key, { ...s, span: 6, condition: windy(condition, s.windSpeed), isNight });
    }
  }
  const even = [...sixes.values()];
  // Hours before the day's first 6-hourly step join it, so the columns stay even
  if (even.length > 1 && even[0].time % (6 * HOUR)) even[1].rain += even.shift().rain;
  return even;
}

// The temperature line's vertical range is at least this, so a day that barely
// changes draws nearly flat instead of as a mountain
const MIN_TEMPERATURE_RANGE = 8; // °C

// Finds the first spell of rain, sleet or snow in a day's steps.
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

    this.config = { days: 5, ...config, ...units };
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
          <span title="Strongest wind">${icon(Wind)}<span class="wind"></span></span>
          <span title="Average pressure">${icon(Gauge)}<span class="pressure"></span></span>
          <span title="Average humidity">${icon(Droplet)}<span class="humidity"></span></span>
        </div>
        <div class="headline">
          <span class="icon"></span><span class="text"></span><span class="extra secondary"></span>
        </div>
        <div class="days"></div>
        <div class="hourly surface" hidden>
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
      </ha-card>`,
    );
    new ResizeObserver(([entry]) => {
      this._hourlyWidth = entry.contentRect.width;
      this._thinHourly();
    }).observe(root.querySelector(".hourly"));

    // The whole card is a button: on the strip it opens today, and on an open
    // day it goes back to the strip, onto that day's tile. Tiles open their own day.
    const card = root.querySelector("ha-card");
    const toggle = () => {
      if (!card.classList.contains("tappable")) return;
      const key = this._day;
      this._day = key ? undefined : this._forecast.days.find((d) => sameDay(d.date, new Date()))?.key;
      this._render();
      if (key) [...root.querySelectorAll(".day")].find((tile) => tile.dataset.day === key)?.focus();
    };
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".day")) toggle();
    });
    card.addEventListener("keydown", (e) => {
      if (e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        toggle();
      }
    });
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
    const step = Math.ceil(MIN_HOUR_WIDTH / column);
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
    const current = forecast && (forecast.steps.findLast((s) => s.time <= now) ?? forecast.steps[0]);

    const conditionLabel = (condition) =>
      hass.localize?.(`component.weather.entity_component._.state.${condition}`) ||
      LABELS[condition] ||
      "";
    const highLow = (d) => (d ? `H ${degrees(d.high)} · L ${degrees(d.low)}` : "");
    // The top of the card: the weather now, or the day picked from the strip
    const showHead = ({ condition, isNight, temp = "", range = "", label = "", sub = "" }) => {
      showCondition($(".now .icon"), condition, isNight);
      $(".temp").textContent = temp;
      $(".range").textContent = range;
      $(".condition").textContent = label;
      $(".name").textContent = sub;
    };
    const card = $("ha-card");
    const tappable = (isTappable) => {
      card.classList.toggle("tappable", isTappable);
      if (isTappable) {
        card.setAttribute("role", "button");
        card.tabIndex = 0;
      } else {
        card.removeAttribute("role");
        card.removeAttribute("tabindex");
      }
    };

    if (!current) {
      showHead({
        label: !this._url() ? "Set latitude and longitude" : this._error ? "Forecast unavailable" : "Loading…",
        sub: c.name,
      });
      for (const el of [".details", ".headline", ".days", ".hourly"]) $(el).hidden = true;
      tappable(false);
      return;
    }

    // Today, with the strip of days below; or the day picked from it, filling the card
    const days = forecast.days.slice(0, c.days);
    const weekday = (d, style) =>
      sameDay(d.date, now) ? "Today" : d.date.toLocaleDateString(lang, { weekday: style });
    const today = forecast.days.find((d) => sameDay(d.date, now));
    const picked = days.find((d) => d.key === this._day);
    if (!picked) this._day = undefined;
    const day = picked ?? today;
    tappable(!!picked || days.includes(today));
    $(".days").hidden = !!picked || !days.length;
    $(".hourly").hidden = !picked;

    // Today's top is the weather now; other days show their high
    const isToday = !!day && sameDay(day.date, now);
    const sub = picked ? [weekday(picked, "long"), c.name].filter(Boolean).join(" · ") : c.name;
    if (isToday || !day) {
      const sensor = hass.states[c.temperature_entity];
      let local = parseFloat(sensor?.state);
      if (sensor?.attributes.unit_of_measurement === "°F") local = ((local - 32) * 5) / 9;
      showHead({
        condition: current.condition,
        isNight: current.isNight,
        temp: degrees(Number.isFinite(local) ? local : current.temperature),
        range: highLow(today),
        label: conditionLabel(current.condition),
        sub,
      });
    } else {
      showHead({
        condition: day.condition,
        temp: degrees(day.high),
        range: highLow(day),
        label: conditionLabel(day.condition),
        sub,
      });
    }

    if (!picked) {
      $(".days").replaceChildren(
        ...days.map((d) => {
          const tile = document.createElement("button");
          tile.className = "day key";
          tile.dataset.day = d.key;
          tile.innerHTML = `
            <span class="weekday secondary"></span>
            <span class="icon"></span>
            <span class="high"></span>
            <span class="low secondary"></span>
            <span class="wet"></span>`;
          tile.querySelector(".weekday").textContent = weekday(d, "short");
          showCondition(tile.querySelector(".icon"), d.condition);
          tile.querySelector(".high").textContent = degrees(d.high);
          tile.querySelector(".low").textContent = degrees(d.low);
          tile.querySelector(".wet").textContent =
            d.rain >= 0.1 ? withUnit("precipitation_unit", d.rain) : "";
          tile.addEventListener("click", () => {
            this._day = d.key;
            this._render();
            card.focus();
          });
          return tile;
        }),
      );
    }

    $(".details").hidden = !day;
    $(".headline").hidden = !day;
    if (!day) return;

    // The day's steps: today from this hour on, other days from midnight
    const steps = isToday ? day.steps.filter((s) => s.time >= thisHour) : day.steps;
    if (!steps.length) steps.push(day.steps.at(-1));

    // Rain headline
    const spell = rainSpell(steps);
    const all = isToday ? "for the rest of the day" : "all day";
    let text = `Dry ${all}`;
    let extra = "";
    if (spell) {
      const when =
        spell.start > 0
          ? `from ${time(steps[spell.start].time)}`
          : spell.end < steps.length
            ? `until ${time(steps[spell.end].time)}`
            : all;
      text = `${spell.kind} ${when}`;
      extra = withUnit("precipitation_unit", spell.total);
    }
    setIcon($(".headline .icon"), spell && spell.kind !== "Rain" ? Snowflake : Umbrella);
    tint($(".headline .icon"), spell && { Rain: "rainy", Sleet: "snowy-rainy", Snow: "snowy" }[spell.kind]);
    $(".headline").classList.toggle("wet", !!spell);
    $(".headline .text").textContent = text;
    $(".headline .extra").textContent = extra;

    // Wind, pressure, humidity
    const windiest = steps.reduce((a, b) => (b.windSpeed > a.windSpeed ? b : a));
    const from = COMPASS[Math.round(windiest.windFrom / 45) % 8] ?? "";
    const average = (key) => steps.reduce((sum, s) => sum + s[key], 0) / steps.length;
    $(".wind").textContent = `${withUnit("wind_speed_unit", windiest.windSpeed)} ${from}`;
    $(".pressure").textContent = withUnit("pressure_unit", average("pressure"));
    $(".humidity").textContent = `${Math.round(average("humidity"))}%`;
    if (!picked) return;

    // Hourly panel: temperatures and icons above rain bars, sharing one row of times
    const cells = (fill) =>
      steps.map((s) => {
        const cell = document.createElement("span");
        fill(cell, s);
        return cell;
      });

    // One column per step: x is the column's center, y is 0 (coldest) to 1 (warmest)
    const temps = steps.map((s) => s.temperature);
    let low = Math.min(...temps);
    let high = Math.max(...temps);
    if (high - low < MIN_TEMPERATURE_RANGE) {
      const middle = (high + low) / 2;
      low = middle - MIN_TEMPERATURE_RANGE / 2;
      high = middle + MIN_TEMPERATURE_RANGE / 2;
    }
    const level = (t) => (t - low) / (high - low);
    const points = steps.map((s, i) => [i + 0.5, (1 - level(s.temperature)) * 100]);
    const line = smoothPath(points);
    $(".temp-line").setAttribute("viewBox", `0 0 ${steps.length} 100`);
    $(".temp-line .line").setAttribute("d", line);
    $(".temp-line .area").setAttribute(
      "d",
      line && `${line}L${points.at(-1)[0]},100L${points[0][0]},100Z`,
    );

    // Each step's value sits just above the line; thinning hides some of them
    $(".temps").replaceChildren(
      ...cells((cell, s) => {
        cell.style.setProperty("--level", level(s.temperature));
        cell.title = `${time(s.time)} · ${degrees(s.temperature)}`;
        const value = document.createElement("span");
        value.className = "value";
        value.textContent = degrees(s.temperature);
        cell.append(value);
      }),
    );
    $(".conditions").replaceChildren(
      ...cells((cell, s) => showCondition(cell, s.condition, s.isNight)),
    );

    // Bars scale by rain per hour, so 6-hourly days compare with hourly ones.
    // Drizzle shouldn't fill the chart, so the scale is at least a steady shower.
    const max = Math.max(2.5, ...steps.map((s) => s.rain / s.span));
    $(".bars").replaceChildren(
      ...cells((bar, s) => {
        bar.className = s.rain > 0 ? "bar" : "bar dry";
        if (s.rain > 0 && WET.has(s.condition)) tint(bar, s.condition);
        bar.style.height = `${(s.rain / s.span / max) * 100}%`;
        bar.title = `${time(s.time)} · ${withUnit("precipitation_unit", s.rain)}`;
      }),
    );

    $(".labels").replaceChildren(
      ...cells((label, s) => (label.textContent = isToday && s === steps[0] ? "Now" : time(s.time, {}))),
    );
    this._thinHourly();
  }

  getCardSize() {
    return 5;
  }
}

registerCard("weather-card", WeatherCard, {
  name: "Weather",
  description: "Met.no forecast: conditions now and the days ahead. Tap a day for its hours, rain and wind",
});
