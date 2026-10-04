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
    const large = c.size === "large";
    const now = new Date();
    const root = this.shadowRoot;

    root.querySelector("ha-card").className = large ? "large" : "";
    root.querySelector(".name").textContent = c.name || "";

    const timeOpts = { hour: "2-digit", minute: "2-digit", timeZone };
    if (c.has_seconds) timeOpts.second = "2-digit";
    if (c.hour12) timeOpts.hour12 = true;
    else timeOpts.hourCycle = "h23";

    // Seconds go in their own half-size span, without the colon before them
    const parts = new Intl.DateTimeFormat(locale, timeOpts).formatToParts(now);
    const nodes = [];
    let text = "";
    const flush = (className) => {
      if (!text) return;
      const span = document.createElement("span");
      if (className) span.className = className;
      span.textContent = text;
      nodes.push(span);
      text = "";
    };
    parts.forEach((p, i) => {
      if (p.type === "second") {
        flush();
        text = p.value;
        flush("sec secondary");
      } else if (!(p.type === "literal" && parts[i + 1]?.type === "second")) {
        text += p.value;
      }
    });
    flush();
    root.querySelector(".time").replaceChildren(...nodes);

    root.querySelector(".date").textContent = c.has_date
      ? now.toLocaleDateString(locale, {
          weekday: "long", day: "numeric", month: "long",
          timeZone,
        })
      : "";
  }

  getCardSize() {
    return 2;
  }
}

registerCard("datetime-card", DateTimeCard, {
  name: "Date & Time",
  description: "A clock with optional seconds, date and title",
});
