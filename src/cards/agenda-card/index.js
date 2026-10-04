import { ChevronDown } from "../../shared/icons.js";
import { createRoot, css, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const DAY = 24 * 3600e3;
const REFRESH = 5 * 60e3;
// The first three calendars get the theme's calendar colors; any more are gray
// unless they set a color, since a fourth hue can't stay distinct from the rest
const COLORS = ["var(--calendar-1)", "var(--calendar-2)", "var(--calendar-3)"];
const OTHER_COLOR = "var(--secondary-text-color, #727272)";

const startOfDay = (date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};
const addDays = (date, days) => {
  const day = new Date(date);
  day.setDate(day.getDate() + days);
  return day;
};
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

// All-day events give a date ("2026-10-08"): that's a local day, not UTC midnight
function parseTime({ date, dateTime }) {
  if (dateTime) return new Date(dateTime);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Google descriptions are often HTML. Parsing them in a detached document turns
// them into plain text without running or showing any of it.
function plainText(html = "") {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  return new DOMParser().parseFromString(withBreaks, "text/html").body.textContent.trim();
}

class AgendaCard extends HTMLElement {
  setConfig(config) {
    const entities = (config.entities ?? []).map((e) => (typeof e === "string" ? { entity: e } : e));
    if (!entities.length || entities.some((e) => !e.entity?.startsWith("calendar."))) {
      throw new Error("Set entities to one or more calendar entities, e.g. [calendar.home]");
    }
    this.config = {
      days: 14,
      max_events: 6,
      ...config,
      entities,
    };
    this._open ??= new Set();
    if (!this.shadowRoot) this._build();
    this._load();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this.config) return;
    // A calendar's state changes when one of its events starts or ends
    const changed = this.config.entities.some(({ entity }) => prev?.states[entity] !== hass.states[entity]);
    if (!prev || changed) this._load();
    else if (prev.locale !== hass.locale) this._render();
  }

  connectedCallback() {
    this._load();
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
    this._run = undefined;
  }

  _calendarName(i) {
    const { entity, name } = this.config.entities[i];
    return name ?? this._hass?.states[entity]?.attributes.friendly_name ?? entity;
  }

  // Fetches today's and the coming days' events from every calendar, then again
  // every few minutes and just after midnight, so "Tomorrow" becomes "Today".
  async _load() {
    clearTimeout(this._timer);
    const hass = this._hass;
    if (!this.isConnected || !hass || !this.config) return;
    const run = (this._run = {});

    const today = startOfDay(new Date());
    const range = new URLSearchParams({
      start: today.toISOString(),
      end: addDays(today, this.config.days).toISOString(),
    });
    const results = await Promise.allSettled(
      this.config.entities.map(({ entity }) => hass.callApi("GET", `calendars/${entity}?${range}`)),
    );
    if (this._run !== run) return; // a newer load, or the card was removed

    this._events = results.flatMap((result, calendar) =>
      result.status === "fulfilled" ? result.value.map((e) => this._parse(e, calendar)) : [],
    );
    this._failed = results.flatMap((result, i) => (result.status === "rejected" ? [this._calendarName(i)] : []));
    this._render();

    const afterMidnight = addDays(today, 1).getTime() + 5e3 - Date.now();
    this._timer = setTimeout(() => this._load(), Math.min(REFRESH, afterMidnight));
  }

  _parse(event, calendar) {
    const allDay = !event.start.dateTime;
    const start = parseTime(event.start);
    return {
      calendar,
      allDay,
      start,
      // All-day ends are exclusive: a one-day event ends at the next midnight
      end: event.end ? parseTime(event.end) : allDay ? addDays(start, 1) : start,
      summary: event.summary ?? "",
      description: plainText(event.description),
      location: event.location ?? "",
    };
  }

  _build() {
    createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="title"></div>
        <div class="days"></div>
        <div class="empty secondary" hidden></div>
        <div class="legend"></div>
        <div class="failed secondary"></div>
      </ha-card>`,
    );
  }

  _render() {
    const root = this.shadowRoot;
    const hass = this._hass;
    if (!root || !hass || !this._events) return;

    const c = this.config;
    const $ = (selector) => root.querySelector(selector);
    const lang = hass.locale?.language ?? hass.language;
    const now = new Date();
    const today = startOfDay(now);

    const time = (date) => date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    // How an end day reads after "until": tomorrow, Fri, or Oct 18
    const dayName = (date) => {
      const n = daysBetween(today, date);
      if (n === 1) return "tomorrow";
      if (n < 7) return date.toLocaleDateString(lang, { weekday: "short" });
      return date.toLocaleDateString(lang, { day: "numeric", month: "short" });
    };

    const events = this._events
      .filter((e) => e.end > now)
      .map((e) => ({
        ...e,
        // An event that began before today, and is still going, shows under Today
        day: e.start < today ? today : startOfDay(e.start),
        key: `${e.calendar}|${e.start.getTime()}|${e.summary}`,
      }))
      .sort((a, b) => a.day - b.day || b.allDay - a.allDay || a.start - b.start)
      .slice(0, c.max_events);

    const days = [];
    for (const e of events) {
      if (days.at(-1)?.day.getTime() !== e.day.getTime()) days.push({ day: e.day, events: [] });
      days.at(-1).events.push(e);
    }

    // The time column: when it starts, or that it's on now, and when it ends if that matters
    const when = (e) => {
      const lastDay = e.allDay ? addDays(e.end, -1) : e.end;
      const multiDay = daysBetween(e.day, lastDay) > 0;
      if (e.allDay) return ["All day", multiDay ? `until ${dayName(lastDay)}` : ""];
      const ongoing = e.start <= now;
      const until = multiDay ? `until ${dayName(e.end)} ${time(e.end)}` : `until ${time(e.end)}`;
      return [ongoing ? "Now" : time(e.start), ongoing || multiDay ? until : ""];
    };

    const multiple = c.entities.length > 1;
    const color = (i) => c.entities[i].color ?? COLORS[i] ?? OTHER_COLOR;

    $(".title").textContent = c.name ?? "";
    $(".days").classList.toggle("with-dots", multiple);
    $(".days").replaceChildren(
      ...days.map(({ day, events }) => {
        const section = document.createElement("section");
        section.className = "day";
        const n = daysBetween(today, day);
        const heading = document.createElement("h3");
        heading.className = "heading";
        heading.textContent =
          n === 0
            ? "Today"
            : n === 1
              ? "Tomorrow"
              : day.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });
        if (n >= 2) {
          const countdown = document.createElement("span");
          countdown.className = "countdown secondary";
          countdown.textContent = `in ${n} days`;
          heading.append(countdown);
        }
        section.append(heading, ...events.map((e) => this._row(e, when(e), multiple && color(e.calendar))));
        return section;
      }),
    );

    const span = c.days % 7 === 0 ? `${c.days / 7} week${c.days === 7 ? "" : "s"}` : `${c.days} days`;
    $(".empty").hidden = events.length > 0;
    $(".empty").textContent = `Nothing in the next ${span}`;

    $(".legend").replaceChildren(
      ...(multiple
        ? c.entities.map((_, i) => {
            const item = document.createElement("span");
            // Only the name is dimmed, so the dot keeps its full color
            item.innerHTML = `<span class="dot"></span><span class="secondary"></span>`;
            item.firstChild.style.background = color(i);
            item.lastChild.textContent = this._calendarName(i);
            return item;
          })
        : []),
    );
    $(".failed").textContent = this._failed.length ? `Couldn't load ${this._failed.join(", ")}` : "";
  }

  // One event. With a description it's a button that shows or hides it.
  _row(e, [main, sub], dotColor) {
    const row = document.createElement(e.description ? "button" : "div");
    row.className = "event";
    row.innerHTML = `
      ${dotColor ? `<span class="dot"></span>` : ""}
      <span class="when"><span class="main"></span><span class="sub secondary"></span></span>
      <span class="what">
        <span class="summary"></span>
        <span class="location secondary"></span>
        <span class="description secondary"></span>
      </span>
      ${e.description ? icon(ChevronDown) : ""}`;
    if (dotColor) row.querySelector(".dot").style.background = dotColor;
    row.querySelector(".main").textContent = main;
    row.querySelector(".sub").textContent = sub;
    row.querySelector(".summary").textContent = e.summary;
    row.querySelector(".location").textContent = e.location;
    row.querySelector(".description").textContent = e.description;

    if (e.description) {
      const show = (open) => {
        row.classList.toggle("open", open);
        row.setAttribute("aria-expanded", open);
      };
      show(this._open.has(e.key));
      row.addEventListener("click", () => {
        const open = !this._open.has(e.key);
        if (open) this._open.add(e.key);
        else this._open.delete(e.key);
        show(open);
      });
    }
    return row;
  }

  getCardSize() {
    return 2 + (this.config?.max_events ?? 6);
  }
}

registerCard("agenda-card", AgendaCard, {
  name: "Agenda",
  description: "Upcoming events from your calendars, today onwards",
});
