import { createRoot, css, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

class DateTimeCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    if (this.shadowRoot) this._tick();
  }

  // Redrawn every second anyway, so a new hass only needs keeping
  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      createRoot(
        this,
        sheet,
        `<ha-card>
          <div class="name secondary"></div>
          <div class="time"></div>
          <div class="date secondary"></div>
          <div class="divider" hidden></div>
          <div class="zones"></div>
        </ha-card>`,
      );
    }
    this._tick();
    this._timer = setInterval(() => this._tick(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  _tick() {
    const c = this.config || {};
    // The home's time zone and Home Assistant's language, unless the config says otherwise
    const locale = c.locale ?? this._hass?.locale?.language ?? this._hass?.language;
    const timeZone = c.time_zone ?? this._hass?.config?.time_zone;
    const now = new Date();
    const root = this.shadowRoot;

    root.querySelector(".name").textContent = c.name || "";

    // The other time zones share this clock, just without seconds
    const clockOpts = { hour: "2-digit", minute: "2-digit" };
    if (c.hour12) clockOpts.hour12 = true;
    else clockOpts.hourCycle = "h23";

    const timeOpts = { ...clockOpts, timeZone };
    if (c.has_seconds) timeOpts.second = "2-digit";

    // Seconds and AM/PM stack, half size, beside the hours and minutes,
    // without the separators that joined them on
    const parts = new Intl.DateTimeFormat(locale, timeOpts).formatToParts(now);
    const aside = ["second", "dayPeriod"];
    const side = {};
    let text = "";
    parts.forEach((p, i) => {
      if (aside.includes(p.type)) side[p.type] = p.value;
      else if (
        p.type !== "literal" ||
        !(aside.includes(parts[i + 1]?.type) || aside.includes(parts[i - 1]?.type))
      ) {
        text += p.value;
      }
    });
    const span = (className, value) => {
      const el = document.createElement("span");
      el.className = className;
      el.textContent = value;
      return el;
    };
    const nodes = [span("hm", text.trim())];
    if (side.second || side.dayPeriod) {
      const col = span("side", "");
      if (side.second) col.append(span("sec secondary", side.second));
      if (side.dayPeriod) col.append(span("period", side.dayPeriod));
      nodes.push(col);
    }
    root.querySelector(".time").replaceChildren(...nodes);

    root.querySelector(".date").textContent = c.has_date
      ? now.toLocaleDateString(locale, {
          weekday: "long", day: "numeric", month: "long",
          timeZone,
        })
      : "";

    const zones = c.other_time_zones || [];
    root.querySelector(".divider").hidden = !zones.length;
    root.querySelector(".zones").replaceChildren(
      ...zones.map((zone) => {
        const row = document.createElement("div");
        row.className = "zone";
        const name = document.createElement("span");
        name.textContent = zone.name || zone.time_zone;
        const time = document.createElement("span");
        time.className = "zone-time";
        time.textContent = now.toLocaleTimeString(locale, {
          ...clockOpts,
          timeZone: zone.time_zone,
        });
        row.append(name, time);
        return row;
      }),
    );
  }

  getCardSize() {
    return 3 + Math.ceil((this.config?.other_time_zones?.length || 0) / 2);
  }
}

registerCard("datetime-card", DateTimeCard, {
  name: "Date & Time",
  description: "A clock with optional seconds, date, title and other time zones",
});
