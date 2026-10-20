import { ArrowDownRight, ArrowUpRight, TriangleWarning } from "../../shared/icons.js";
import { createRoot, css, registerCard } from "../../shared/card.js";
import { smoothPath } from "../../shared/chart.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const API_URL = "https://api.open-meteo.com/v1/forecast";
const HOUR = 3600e3;

// Open-Meteo reports hPa; each unit converts from it. `change` is the digits
// for a rise or fall, which are small enough to need one more.
const UNITS = {
  hPa: { label: "hPa", convert: (p) => p, digits: 0, change: 1 },
  mbar: { label: "mbar", convert: (p) => p, digits: 0, change: 1 },
  inHg: { label: "inHg", convert: (p) => p * 0.02953, digits: 2, change: 2 },
  mmHg: { label: "mmHg", convert: (p) => p * 0.750062, digits: 0, change: 1 },
};

const DEFAULTS = {
  past_hours: 40,
  forecast_hours: 72,
  // A fall of this many hPa over 24 hours makes a migraine likely (Kimoto et al. 2011)
  migraine_drop: 5,
  // A rise of this many hPa over 24 hours, for people whose migraines follow
  // rises. Off, as Kimoto et al. found fewer migraines after rises, not more.
  migraine_rise: false,
};
// Open-Meteo keeps about 92 days of past forecasts and looks 16 days ahead.
// The card fetches 24 hours more than it shows, to know each hour's 24-hour change.
const MAX_PAST_HOURS = 2160;
const MAX_FORECAST_HOURS = 383;

// The chart's height covers at least this, so a calm day draws nearly flat
const MIN_RANGE = 16; // hPa
// A 24-hour change smaller than this reads as steady
const STEADY = 1; // hPa
// Grid steps in the shown unit; the first giving four or fewer lines is used
const TICK_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
// A day's name shows under it only if this many hours of it are on the chart
const MIN_DAY_HOURS = 8;
// Times show every this many hours, as "06:00" if each gets this many pixels, otherwise "06"
const TIME_STEP = 6;
const FULL_TIME_WIDTH = 40; // px

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const isWhole = (v) => Number.isInteger(v) && v > 0;
const svg = (tag, attrs) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
};

// Turns Open-Meteo's hourly arrays into hours, each with its change from 24 hours before
function parseHours(json) {
  const times = json?.hourly?.time ?? [];
  const values = json?.hourly?.pressure_msl ?? [];
  const byTime = new Map();
  const hours = [];
  times.forEach((t, i) => {
    if (typeof values[i] !== "number") return;
    const hour = { time: t * 1000, pressure: values[i] };
    byTime.set(hour.time, hour.pressure);
    hours.push(hour);
  });
  for (const hour of hours) {
    const before = byTime.get(hour.time - 24 * HOUR);
    hour.change = before == null ? null : hour.pressure - before;
  }
  return hours;
}

// Runs of consecutive hours that pass `test`, as [first, last] indexes
function runs(hours, test) {
  const found = [];
  hours.forEach((h, i) => {
    if (!test(h)) return;
    const last = found.at(-1);
    if (last && last[1] === i - 1) last[1] = i;
    else found.push([i, i]);
  });
  return found;
}

class PressureCard extends HTMLElement {
  setConfig(config) {
    for (const key of ["latitude", "longitude"]) {
      if (config[key] != null && typeof config[key] !== "number") {
        throw new Error(`${key} must be a number`);
      }
    }
    if ((config.latitude == null) !== (config.longitude == null)) {
      throw new Error("Set both latitude and longitude, or neither to use your home location");
    }
    if (config.past_hours != null && !(isWhole(config.past_hours) && config.past_hours <= MAX_PAST_HOURS)) {
      throw new Error(`past_hours must be a whole number from 1 to ${MAX_PAST_HOURS}`);
    }
    if (
      config.forecast_hours != null &&
      !(isWhole(config.forecast_hours) && config.forecast_hours <= MAX_FORECAST_HOURS)
    ) {
      throw new Error(`forecast_hours must be a whole number from 1 to ${MAX_FORECAST_HOURS}`);
    }
    for (const key of ["migraine_drop", "migraine_rise"]) {
      const v = config[key];
      if (v != null && v !== false && !(typeof v === "number" && v > 0)) {
        throw new Error(`${key} must be a positive number of hPa, or false`);
      }
    }
    let unit;
    if (config.pressure_unit != null) {
      unit = Object.keys(UNITS).find((u) => u.toLowerCase() === String(config.pressure_unit).toLowerCase());
      if (!unit) throw new Error(`pressure_unit must be one of: ${Object.keys(UNITS).join(", ")}`);
    }

    this.config = { ...DEFAULTS, ...config, pressure_unit: unit };
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
    else if (!prev || prev.locale !== hass.locale || prev.config !== hass.config) this._render();
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
    if (typeof lat !== "number" || typeof lon !== "number") return undefined;
    const params = new URLSearchParams({
      // Open-Meteo's grid is coarser than 0.01° (about 1 km), so more decimals change nothing
      latitude: lat.toFixed(2),
      longitude: lon.toFixed(2),
      hourly: "pressure_msl",
      past_hours: c.past_hours + 24,
      // The current hour counts as the first forecast hour
      forecast_hours: c.forecast_hours + 1,
      timeformat: "unixtime",
      timezone: "GMT",
    });
    return `${API_URL}?${params}`;
  }

  // Fetches the hours, then again just after each hour, when Open-Meteo has
  // moved on by one
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
      if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
      this._hours = parseHours(await res.json());
      this._error = undefined;
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 5, 0, 0);
      wait = nextHour - Date.now();
    } catch (err) {
      if (abort.signal.aborted) return;
      this._error = err.message;
    }
    this._render();
    this._timer = setTimeout(() => this._load(), Math.max(60e3, wait));
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="now">
          <div>
            <div class="reading"><span class="value"></span><span class="unit secondary"></span></div>
            <div class="trend secondary"></div>
          </div>
          <div class="risk">
            <div class="secondary">Migraine risk</div>
            <div class="level"><span class="icon"></span><span class="text"></span></div>
          </div>
        </div>
        <div class="headline">
          <span class="icon"></span><span class="text"></span><span class="extra secondary"></span>
        </div>
        <div class="chart">
          <span class="now-label secondary">Now</span>
          <div class="plot">
            <svg preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <clipPath id="past"><rect y="-20" height="140"></rect></clipPath>
                <clipPath id="future"><rect y="-20" height="140"></rect></clipPath>
                <clipPath id="likely"></clipPath>
              </defs>
              <g class="grid"></g>
              <path class="threshold drop" vector-effect="non-scaling-stroke"></path>
              <path class="threshold rise" vector-effect="non-scaling-stroke"></path>
              <g class="past" clip-path="url(#past)">
                <path class="line" vector-effect="non-scaling-stroke"></path>
                <path class="line likely" clip-path="url(#likely)" vector-effect="non-scaling-stroke"></path>
              </g>
              <g clip-path="url(#future)">
                <path class="line" vector-effect="non-scaling-stroke"></path>
                <path class="line likely" clip-path="url(#likely)" vector-effect="non-scaling-stroke"></path>
              </g>
            </svg>
            <div class="ticks"></div>
            <div class="now-line"></div>
            <span class="dot current"></span>
            <div class="cursor" hidden></div>
            <span class="dot hover" hidden></span>
          </div>
          <div class="tooltip" hidden></div>
        </div>
        <div class="axis secondary">
          <div class="times"></div>
          <div class="days"></div>
        </div>
        <div class="message secondary"></div>
      </ha-card>`,
    );

    // Hover, or drag a finger across, to read an hour
    const chart = root.querySelector(".chart");
    chart.addEventListener("pointermove", (e) => this._showCursor(e));
    chart.addEventListener("pointerdown", (e) => this._showCursor(e));
    chart.addEventListener("pointerleave", () => this._hideCursor());

    // The times along the bottom depend on the chart's width
    new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === this._plotWidth) return;
      this._plotWidth = entry.contentRect.width;
      this._render();
    }).observe(root.querySelector(".plot"));
  }

  // Number formatting and migraine tests for the current config and locale
  _format() {
    const c = this.config;
    const hass = this._hass;
    const lang = hass.locale?.language ?? hass.language;
    const unit = UNITS[c.pressure_unit ?? (hass.config?.unit_system?.temperature === "°F" ? "inHg" : "hPa")];
    const number = (hPa, digits) =>
      // `+ 0` turns -0 into 0
      (Number(unit.convert(hPa).toFixed(digits)) + 0).toLocaleString(lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
      });
    const pressure = (hPa) => number(hPa, unit.digits);
    const change = (hPa) => {
      const text = number(Math.abs(hPa), unit.change);
      if (Number(unit.convert(Math.abs(hPa)).toFixed(unit.change)) === 0) return text;
      return `${hPa < 0 ? "−" : "+"}${text}`;
    };
    const time = (t) => {
      const date = new Date(t);
      const clock = date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      return date.toDateString() === new Date().toDateString()
        ? clock
        : `${date.toLocaleDateString(lang, { weekday: "short" })} ${clock}`;
    };
    const falling = (h) => !!c.migraine_drop && h.change != null && h.change <= -c.migraine_drop;
    const rising = (h) => !!c.migraine_rise && h.change != null && h.change >= c.migraine_rise;
    const likely = (h) => falling(h) || rising(h);
    return { lang, unit, number, pressure, change, time, falling, rising, likely };
  }

  _render() {
    const root = this.shadowRoot;
    const hass = this._hass;
    if (!root || !hass) return;
    const c = this.config;
    const $ = (selector) => root.querySelector(selector);
    const f = this._format();
    const { unit } = f;

    const thisHour = new Date();
    thisHour.setMinutes(0, 0, 0);
    const from = thisHour - c.past_hours * HOUR;
    const to = +thisHour + c.forecast_hours * HOUR;
    const hours = (this._hours ?? []).filter((h) => h.time >= from && h.time <= to);
    const nowIndex = hours.findLastIndex((h) => h.time <= thisHour);
    const current = hours[nowIndex];

    const ready = hours.length >= 2 && !!current;
    for (const el of [".now", ".headline", ".chart", ".axis"]) $(el).hidden = !ready;
    $(".message").textContent = !this._url()
      ? "Set latitude and longitude"
      : this._error
        ? "Pressure unavailable"
        : ready
          ? ""
          : "Loading…";
    this._view = undefined;
    if (!ready) return;

    // Now: the reading, its 24-hour change and the migraine risk
    $(".value").textContent = f.pressure(current.pressure);
    $(".unit").textContent = unit.label;
    $(".trend").textContent =
      current.change == null
        ? ""
        : `${current.change <= -STEADY ? "Falling" : current.change >= STEADY ? "Rising" : "Steady"} · ${f.change(current.change)} ${unit.label} in 24 h`;

    const migraine = !!(c.migraine_drop || c.migraine_rise);
    const likelyNow = f.likely(current);
    $(".risk").hidden = !migraine;
    $(".level").classList.toggle("likely", likelyNow);
    $(".level .icon").replaceChildren(...(likelyNow ? [TriangleWarning({ weight: "Outline" })] : []));
    $(".level .text").textContent = likelyNow ? "Likely" : "Unlikely";

    // Headline: when the next sharp fall or rise is, in the hours ahead
    const ahead = hours.slice(nowIndex);
    $(".headline").hidden = !migraine;
    if (migraine) {
      const fall = runs(ahead, f.falling)[0];
      const rise = runs(ahead, f.rising)[0];
      // Whichever comes first
      const rising = !!rise && (!fall || rise[0] < fall[0]);
      const spell = rising ? rise : fall;
      const span = `${c.forecast_hours} hour${c.forecast_hours === 1 ? "" : "s"}`;
      const watched = [c.migraine_drop && "falls", c.migraine_rise && "rises"].filter(Boolean).join(" or ");
      let text = `No sharp ${watched} in the next ${span}`;
      let extra = "";
      if (spell) {
        const [first, last] = spell;
        const end = ahead[last + 1];
        const moving = rising ? "Rising fast" : "Falling fast";
        text =
          first > 0
            ? `${moving} from ${f.time(ahead[first].time)}`
            : end
              ? `${moving} until ${f.time(end.time)}`
              : `${moving} for the next ${span}`;
        const changes = ahead.slice(first, last + 1).map((h) => h.change);
        const steepest = rising ? Math.max(...changes) : Math.min(...changes);
        extra = `${f.change(steepest)} ${unit.label} in 24 h`;
      }
      $(".headline").classList.toggle("likely", !!spell);
      $(".headline .icon").replaceChildren((rising ? ArrowUpRight : ArrowDownRight)({ weight: "Outline" }));
      $(".headline .text").textContent = text;
      $(".headline .extra").textContent = extra;
    }

    // Each hour's migraine thresholds: its pressure 24 hours before, less
    // migraine_drop and plus migraine_rise. The line is likely migraine weather
    // wherever it's below the first or above the second.
    const threshold = (amount) =>
      hours.map((h) => (amount && h.change != null ? h.pressure - h.change + amount : null));
    const dropThresholds = threshold(c.migraine_drop && -c.migraine_drop);
    const riseThresholds = threshold(c.migraine_rise);

    // Chart: x is hours from the first hour, y is 0 (top) to 100 (bottom).
    // The range takes in the thresholds too, so they're always in view.
    const last = hours.length - 1;
    const values = [
      ...hours.map((h) => h.pressure),
      ...[...dropThresholds, ...riseThresholds].filter((t) => t != null),
    ];
    let low = Math.min(...values) - 1;
    let high = Math.max(...values) + 1;
    if (high - low < MIN_RANGE) {
      const middle = (high + low) / 2;
      low = middle - MIN_RANGE / 2;
      high = middle + MIN_RANGE / 2;
    }
    const y = (hPa) => ((high - hPa) / (high - low)) * 100;
    const x = (t) => (t - hours[0].time) / HOUR;
    const percent = (t) => (x(t) / last) * 100;

    $(".plot svg").setAttribute("viewBox", `0 0 ${last} 100`);
    const line = smoothPath(hours.map((h, i) => [i, y(h.pressure)]));
    root.querySelectorAll(".line").forEach((path) => path.setAttribute("d", line));
    const nowX = x(current.time);
    const [past, future] = root.querySelectorAll("clipPath rect");
    past.setAttribute("x", -1);
    past.setAttribute("width", nowX + 1);
    future.setAttribute("x", nowX);
    future.setAttribute("width", last - nowX + 1);
    // Each run of likely hours, from half an hour before its first to half an hour after its last
    $("#likely").replaceChildren(
      ...runs(hours, f.likely).map(([a, b]) =>
        svg("rect", { x: a - 0.5, width: b - a + 1, y: -20, height: 140 }),
      ),
    );

    const thresholdPath = (thresholds) => smoothPath(thresholds.flatMap((t, i) => (t == null ? [] : [[i, y(t)]])));
    $(".threshold.drop").setAttribute("d", thresholdPath(dropThresholds));
    $(".threshold.rise").setAttribute("d", thresholdPath(riseThresholds));

    // Grid lines on round values of the shown unit, labelled at the right.
    // Lines at the very top or bottom are left out, so their labels fit.
    const lowShown = unit.convert(low);
    const highShown = unit.convert(high);
    const step = TICK_STEPS.find((s) => (highShown - lowShown) / s <= 4) ?? TICK_STEPS.at(-1);
    const stepDigits = String(step).split(".")[1]?.length ?? 0;
    const grid = [];
    const ticks = [];
    for (let v = Math.ceil(lowShown / step) * step; v <= highShown; v += step) {
      const top = ((highShown - v) / (highShown - lowShown)) * 100;
      if (top < 5 || top > 95) continue;
      grid.push(svg("line", { x1: 0, x2: last, y1: top, y2: top, "vector-effect": "non-scaling-stroke" }));
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.style.top = `${top}%`;
      tick.textContent = v.toLocaleString(f.lang, {
        minimumFractionDigits: stepDigits,
        maximumFractionDigits: stepDigits,
        useGrouping: false,
      });
      ticks.push(tick);
    }

    // Midnights split the days; each day's name sits in the middle of its part
    const days = [];
    const midnight = new Date(hours[0].time);
    midnight.setHours(0, 0, 0, 0);
    for (let start = midnight; start < hours[last].time; ) {
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      const a = Math.max(+start, hours[0].time);
      const b = Math.min(+next, hours[last].time);
      if (+start > hours[0].time) {
        const mx = x(+start);
        grid.push(svg("line", { class: "day", x1: mx, x2: mx, y1: 0, y2: 100, "vector-effect": "non-scaling-stroke" }));
      }
      if ((b - a) / HOUR >= MIN_DAY_HOURS) {
        const label = document.createElement("span");
        label.style.left = `${(percent(a) + percent(b)) / 2}%`;
        label.textContent =
          start.toDateString() === new Date().toDateString()
            ? "Today"
            : start.toLocaleDateString(f.lang, { weekday: "short" });
        days.push(label);
      }
      start = next;
    }
    $(".grid").replaceChildren(...grid);
    $(".ticks").replaceChildren(...ticks);
    $(".days").replaceChildren(...days);

    // Times every TIME_STEP hours between midnights, which the day lines mark.
    // A time too close to an edge to fit is left out.
    const width = this._plotWidth ?? 0;
    const full = (width / last) * TIME_STEP >= FULL_TIME_WIDTH;
    const half = full ? 16 : 8; // px, about half a label
    const times = [];
    for (const h of hours) {
      const date = new Date(h.time);
      const hour = date.getHours();
      if (hour === 0 || hour % TIME_STEP) continue;
      const px = (percent(h.time) / 100) * width;
      if (px < half || px > width - half) continue;
      const label = document.createElement("span");
      label.style.left = `${percent(h.time)}%`;
      label.textContent = date.toLocaleTimeString(f.lang, {
        hour: "2-digit",
        ...(full && { minute: "2-digit" }),
        hourCycle: "h23",
      });
      times.push(label);
    }
    $(".times").replaceChildren(...times);

    for (const el of [".now-label", ".now-line", ".dot.current"]) $(el).style.left = `${percent(current.time)}%`;
    $(".dot.current").style.top = `${y(current.pressure)}%`;
    $(".dot.current").classList.toggle("likely", likelyNow);

    this._view = { hours, y, last, f };
  }

  _showCursor(e) {
    const view = this._view;
    if (!view) return;
    const { hours, y, last, f } = view;
    const root = this.shadowRoot;
    const plot = root.querySelector(".plot").getBoundingClientRect();
    const i = Math.round(clamp((e.clientX - plot.left) / plot.width, 0, 1) * last);
    const h = hours[i];
    const left = `${(i / last) * 100}%`;

    const cursor = root.querySelector(".cursor");
    cursor.hidden = false;
    cursor.style.left = left;
    const dot = root.querySelector(".dot.hover");
    dot.hidden = false;
    dot.style.left = left;
    dot.style.top = `${y(h.pressure)}%`;
    dot.classList.toggle("likely", f.likely(h));

    const tooltip = root.querySelector(".tooltip");
    tooltip.hidden = false;
    tooltip.innerHTML = `
      <div class="when secondary"></div>
      <div class="amount"></div>
      <div class="change secondary"></div>
      <div class="note"></div>`;
    tooltip.querySelector(".when").textContent = f.time(h.time);
    tooltip.querySelector(".amount").textContent = `${f.pressure(h.pressure)} ${f.unit.label}`;
    tooltip.querySelector(".change").textContent =
      h.change == null ? "" : `${f.change(h.change)} ${f.unit.label} in 24 h`;
    tooltip.querySelector(".note").textContent = f.likely(h) ? "Migraine likely" : "";
    // Keep the tooltip beside the cursor, on whichever side has room
    tooltip.classList.toggle("left", i / last > 0.5);
    tooltip.style.left = left;
  }

  _hideCursor() {
    const root = this.shadowRoot;
    for (const el of [".cursor", ".dot.hover", ".tooltip"]) root.querySelector(el).hidden = true;
  }

  getCardSize() {
    return 5;
  }
}

registerCard("pressure-card", PressureCard, {
  name: "Pressure",
  description: "Open-Meteo air pressure, past and forecast, with the falls that tend to bring on migraines",
});
