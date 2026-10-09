import { createRoot, css, registerCard } from "../../shared/card.js";
import { smoothPath } from "../../shared/chart.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const MINUTE = 60e3;
// Most points per line. Beyond this, readings are averaged: more points than
// pixels only adds noise.
const MAX_POINTS = 360; // an hour of 10-second readings
const REFETCH = 30 * MINUTE; // reload history, in case updates were missed while asleep
// Steps for the time labels, in minutes; the first giving four or fewer labels is used
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

// Lines are the accent color up to WARN_FROM percent full, then blend to the
// danger color, which they reach at DANGER_AT
const WARN_FROM = 60;
const DANGER_AT = 90;

// Every sensor reports percent used, so all three share one 0–100% scale.
// Color shows how full; the dash pattern shows which line is which.
const SERIES = [
  { label: "CPU", entity: "cpu_entity", size: null, dash: "" },
  { label: "RAM", entity: "memory_entity", size: "memory_size", dash: "6 4" },
  { label: "SSD", entity: "disk_entity", size: "disk_size", dash: "0.5 4.5" },
];

const DEFAULTS = {
  cpu_entity: "sensor.system_monitor_processor_use",
  memory_entity: "sensor.system_monitor_memory_usage",
  disk_entity: "sensor.system_monitor_disk_usage",
  minutes: 60,
  interval: 10,
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// The line color at a given percent, matching the chart's gradient
function loadColor(percent) {
  const mix = clamp((percent - WARN_FROM) / (DANGER_AT - WARN_FROM), 0, 1);
  return mix === 0
    ? "var(--accent)"
    : `color-mix(in srgb, var(--danger) ${Math.round(mix * 100)}%, var(--accent))`;
}

// Averages the readings in each time bucket. An empty bucket keeps the last
// value, since Home Assistant only records a reading when it changes.
function bucket(points, start, end, count) {
  const size = (end - start) / count;
  const values = [];
  let i = 0;
  let last = null;
  for (let b = 0; b < count; b++) {
    const bucketEnd = start + (b + 1) * size;
    let sum = 0;
    let count = 0;
    while (i < points.length && points[i].t < bucketEnd) {
      if (points[i].t >= start) {
        sum += points[i].v;
        count++;
      }
      last = points[i].v;
      i++;
    }
    values.push(count ? sum / count : last);
  }
  return values;
}

const lineKey = (dash) =>
  `<svg class="key" viewBox="0 0 16 8" aria-hidden="true"><line x1="2" y1="4" x2="14" y2="4" stroke-dasharray="${dash}"></line></svg>`;

class ServerCard extends HTMLElement {
  setConfig(config) {
    for (const key of ["memory_size", "disk_size", "minutes"]) {
      if (config[key] != null && !(typeof config[key] === "number" && config[key] > 0)) {
        throw new Error(`${key} must be a positive number`);
      }
    }
    if (config.interval != null && !(config.interval >= 10 && config.interval % 10 === 0)) {
      throw new Error("interval must be in seconds, in steps of 10: 10, 20, 30…");
    }
    this.config = { ...DEFAULTS, ...config };
    if (!this.shadowRoot) this._build();
    this._loadHistory();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.config) return;
    let changed = !prev || prev.locale !== hass.locale;
    for (const s of SERIES) {
      const id = this.config[s.entity];
      const state = hass.states[id];
      if (!state || state === prev?.states[id]) continue;
      changed = true;
      // New readings extend the line; history covers everything before
      const v = parseFloat(state.state);
      if (this._history && Number.isFinite(v)) {
        (this._history[id] ??= []).push({ t: Date.parse(state.last_updated), v });
      }
    }
    if (changed) this._render();
  }

  connectedCallback() {
    this._loadHistory();
    this._refetch = setInterval(() => this._loadHistory(), REFETCH);
    // Redraw at each reporting interval, so the chart moves on even when no
    // reading has changed
    this._tick = setInterval(() => this._render(), this.config.interval * 1000);
  }

  disconnectedCallback() {
    clearInterval(this._refetch);
    clearInterval(this._tick);
    this._run = undefined;
  }

  // Loads each sensor's readings over the last `minutes` from Home Assistant's history
  async _loadHistory() {
    const hass = this._hass;
    if (!this.isConnected || !hass || !this.config) return;
    const run = (this._run = {});
    const end = new Date();
    const start = new Date(end - this.config.minutes * MINUTE);
    const ids = SERIES.map((s) => this.config[s.entity]);
    const params = new URLSearchParams({ filter_entity_id: ids.join(","), end_time: end.toISOString() });

    try {
      const result = await hass.callApi(
        "GET",
        `history/period/${start.toISOString()}?${params}&minimal_response&no_attributes`,
      );
      if (this._run !== run) return;
      // With minimal_response, only each list's first entry names its entity
      this._history = {};
      for (const list of result) {
        const id = list[0]?.entity_id;
        if (!id) continue;
        this._history[id] = list
          .map((s) => ({ t: Date.parse(s.last_changed ?? s.last_updated), v: parseFloat(s.state) }))
          .filter((p) => Number.isFinite(p.v));
      }
      this._error = undefined;
    } catch (err) {
      if (this._run !== run) return;
      this._history ??= {};
      this._error = "Couldn't load history";
    }
    this._render();
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="title"></div>
        <div class="stats"></div>
        <div class="chart">
          <div class="plot">
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="load" gradientUnits="userSpaceOnUse" x1="0" y1="100" x2="0" y2="0">
                  <stop class="ok" offset="${WARN_FROM / 100}"></stop>
                  <stop class="danger" offset="${DANGER_AT / 100}"></stop>
                </linearGradient>
              </defs>
              <line class="grid" x1="0" x2="1000" y1="0" y2="0" vector-effect="non-scaling-stroke"></line>
              <line class="grid" x1="0" x2="1000" y1="50" y2="50" vector-effect="non-scaling-stroke"></line>
              <line class="grid base" x1="0" x2="1000" y1="100" y2="100" vector-effect="non-scaling-stroke"></line>
              <g class="lines"></g>
            </svg>
            <span class="tick" style="top: 0">100%</span>
            <span class="tick" style="top: 50%">50%</span>
            <div class="ends"></div>
            <div class="cursor" hidden></div>
          </div>
          <div class="tooltip" hidden></div>
        </div>
        <div class="times secondary"></div>
        <div class="error secondary"></div>
      </ha-card>`,
    );

    // Hover, or drag a finger across, to read the values at a time
    const chart = root.querySelector(".chart");
    chart.addEventListener("pointermove", (e) => this._showCursor(e));
    chart.addEventListener("pointerdown", (e) => this._showCursor(e));
    chart.addEventListener("pointerleave", () => this._hideCursor());
  }

  // Each series with its entity, current reading and how to show a value
  _series() {
    const c = this.config;
    const lang = this._hass?.locale?.language ?? this._hass?.language;
    return SERIES.map((s) => {
      const id = c[s.entity];
      const size = s.size && c[s.size];
      const current = parseFloat(this._hass?.states[id]?.state);
      // Percent, or the amount used out of `size` GB (shown in TB from 1000 GB)
      const amount = (percent) => {
        if (!size) return { value: Math.round(percent), unit: "%" };
        let used = (percent * size) / 100;
        let unit = "GB";
        if (used >= 1000) {
          used /= 1000;
          unit = "TB";
        }
        const digits = used < 10 ? 1 : 0;
        return { value: used.toLocaleString(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }), unit };
      };
      return { ...s, id, current, amount };
    });
  }

  _render() {
    const root = this.shadowRoot;
    if (!root || !this._hass) return;
    const $ = (selector) => root.querySelector(selector);
    const c = this.config;
    const lang = this._hass.locale?.language ?? this._hass.language;
    const series = this._series();

    $(".title").textContent = c.name ?? "";

    // The readings, which also serve as the legend
    $(".stats").replaceChildren(
      ...series.map((s) => {
        const stat = document.createElement("div");
        stat.className = "stat";
        stat.innerHTML = `
          <div class="label">${lineKey(s.dash)}<span class="secondary"></span></div>
          <div class="reading"><span class="value"></span><span class="unit secondary"></span></div>`;
        stat.querySelector(".label span").textContent = s.label;
        const known = Number.isFinite(s.current);
        const { value, unit } = known ? s.amount(s.current) : { value: "–", unit: "" };
        stat.querySelector(".value").textContent = value;
        stat.querySelector(".unit").textContent = unit;
        stat.querySelector(".key").style.color = known ? loadColor(s.current) : "var(--accent)";
        return stat;
      }),
    );

    if (!this._history) return; // still loading

    const end = Date.now();
    const start = end - c.minutes * MINUTE;
    // One point per reading, or an average of several over long periods
    const count = Math.max(1, Math.min(MAX_POINTS, Math.round((c.minutes * 60) / c.interval)));
    const x = (b) => ((b + 0.5) / count) * 1000;
    const y = (percent) => 100 - clamp(percent, 0, 100);

    this._view = { start, end, count, series: [] };
    const lines = [];
    const ends = [];
    for (const s of series) {
      const points = this._history[s.id] ?? [];
      // Forget readings older than the one in effect at the start
      const first = points.findLastIndex((p) => p.t < start);
      if (first > 0) points.splice(0, first);

      const values = bucket(points, start, end, count);
      this._view.series.push({ ...s, values });
      const xy = values.flatMap((v, b) => (v == null ? [] : [[x(b), y(v)]]));
      if (Number.isFinite(s.current)) xy.push([1000, y(s.current)]);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", smoothPath(xy));
      path.setAttribute("stroke", "url(#load)");
      path.setAttribute("vector-effect", "non-scaling-stroke");
      if (s.dash) path.setAttribute("stroke-dasharray", s.dash);
      lines.push(path);

      if (Number.isFinite(s.current)) {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.top = `${y(s.current)}%`;
        dot.style.background = loadColor(s.current);
        ends.push(dot);
      }
    }
    $(".lines").replaceChildren(...lines);
    $(".ends").replaceChildren(...ends);

    // Clock times on round steps (every 15 minutes over an hour, 6 hours over a
    // day), then Now. Times too close to an edge are left out, so labels never collide.
    const time = (t) => new Date(t).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const step = (TIME_STEPS.find((m) => c.minutes / m <= 4) ?? TIME_STEPS.at(-1)) * MINUTE;
    const label = (f, text) => {
      const el = document.createElement("span");
      el.style.left = `${f * 100}%`;
      el.textContent = text;
      return el;
    };
    const midnight = new Date(end);
    midnight.setHours(0, 0, 0, 0);
    const labels = [];
    for (let t = midnight - Math.ceil((midnight - start) / step) * step; t < end; t += step) {
      const f = (t - start) / (end - start);
      if (f > 0.05 && f < 0.88) labels.push(label(f, time(t)));
    }
    $(".times").replaceChildren(...labels, label(1, "Now"));
    $(".error").textContent = this._error ?? "";
  }

  _showCursor(e) {
    const view = this._view;
    if (!view) return;
    const root = this.shadowRoot;
    const plot = root.querySelector(".plot").getBoundingClientRect();
    const f = clamp((e.clientX - plot.left) / plot.width, 0, 1);
    const b = Math.min(view.count - 1, Math.floor(f * view.count));
    const size = (view.end - view.start) / view.count;
    const at = view.start + (b + 0.5) * size;
    const lang = this._hass.locale?.language ?? this._hass.language;

    const cursor = root.querySelector(".cursor");
    cursor.hidden = false;
    cursor.style.left = `${f * 100}%`;

    const tooltip = root.querySelector(".tooltip");
    tooltip.hidden = false;
    tooltip.innerHTML = `<div class="when secondary"></div>`;
    // With points under a minute apart, the time shows seconds too
    tooltip.firstChild.textContent = new Date(at).toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      ...(size < MINUTE && { second: "2-digit" }),
      hourCycle: "h23",
    });
    for (const s of view.series) {
      const v = s.values[b];
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `${lineKey(s.dash)}<span class="secondary"></span><span class="amount"></span>`;
      row.querySelector(".key").style.color = v == null ? "var(--accent)" : loadColor(v);
      row.querySelector("span").textContent = s.label;
      if (v != null) {
        const { value, unit } = s.amount(v);
        row.querySelector(".amount").textContent = `${value} ${unit}`.replace(" %", "%");
      } else {
        row.querySelector(".amount").textContent = "–";
      }
      tooltip.append(row);
    }
    // Keep the tooltip beside the cursor, on whichever side has room
    tooltip.classList.toggle("left", f > 0.5);
    tooltip.style.left = `${f * 100}%`;
  }

  _hideCursor() {
    this.shadowRoot.querySelector(".cursor").hidden = true;
    this.shadowRoot.querySelector(".tooltip").hidden = true;
  }

  getCardSize() {
    return 4;
  }
}

registerCard("server-card", ServerCard, {
  name: "Server",
  description: "CPU, RAM and storage use, now and over time, on one chart",
});
