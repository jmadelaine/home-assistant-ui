import { Bulb2, Setting4, Sun } from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const KEY_STEP = 5; // percent per arrow key on the slider
// After a change, the slider keeps showing it until the light reports back,
// so it doesn't jump to the old brightness in between
const PENDING_FOR = 3000;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

class LightCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity?.startsWith("light.")) {
      throw new Error("Set entity to a light, e.g. light.bedroom");
    }
    this.config = { ...config };
    if (!this.shadowRoot) this._build();
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot) this._sync();
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="header">
          <div class="title"></div>
          <button class="options">${icon(Setting4)}</button>
        </div>
        <div class="controls">
          <button class="key power">${icon(Bulb2)}${icon(Bulb2, "Filled")}</button>
          <div class="slider" role="slider" tabindex="0" aria-label="Brightness"
            aria-valuemin="0" aria-valuemax="100">
            <div class="fill"></div>
            <div class="value">${icon(Sun)}<span></span></div>
          </div>
        </div>
      </ha-card>`,
    );

    root.querySelector(".power").addEventListener("click", () => this._call("toggle"));
    // Home Assistant's own dialog for the light: color, favorites, effects
    root.querySelector(".options").addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: { entityId: this.config.entity },
        }),
      );
      haptic(this);
    });
    this._bindSlider(root.querySelector(".slider"));
  }

  // Drag or tap anywhere on the bar to set the brightness; it's sent when you
  // let go. Vertical swipes scroll the page instead (touch-action: pan-y).
  _bindSlider(slider) {
    const valueAt = (e) => {
      const { left, width } = slider.getBoundingClientRect();
      return Math.round(clamp((e.clientX - left) / width, 0, 1) * 100);
    };
    slider.addEventListener("pointerdown", (e) => {
      if (this._unavailable) return;
      slider.setPointerCapture(e.pointerId);
      this._dragging = true;
      this._showBrightness(valueAt(e));
    });
    slider.addEventListener("pointermove", (e) => {
      if (this._dragging) this._showBrightness(valueAt(e));
    });
    slider.addEventListener("pointerup", (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      this._setBrightness(valueAt(e));
    });
    // The browser took the touch for a scroll: put the slider back
    slider.addEventListener("pointercancel", () => {
      this._dragging = false;
      this._sync();
    });
    slider.addEventListener("keydown", (e) => {
      if (this._unavailable) return;
      const now = this._shownBrightness;
      const next = {
        ArrowRight: now + KEY_STEP,
        ArrowUp: now + KEY_STEP,
        ArrowLeft: now - KEY_STEP,
        ArrowDown: now - KEY_STEP,
        Home: 0,
        End: 100,
      }[e.key];
      if (next == null) return;
      e.preventDefault();
      this._setBrightness(clamp(next, 0, 100));
    });
  }

  // 0 turns the light off; anything else turns it on at that brightness
  _setBrightness(value) {
    this._pending = { value, until: Date.now() + PENDING_FOR };
    clearTimeout(this._pendingTimer);
    // If the light never reports back, fall back to what it last said
    this._pendingTimer = setTimeout(() => this._sync(), PENDING_FOR);
    this._showBrightness(value);
    if (value === 0) this._call("turn_off");
    else this._call("turn_on", { brightness_pct: value });
  }

  _showBrightness(value) {
    this._shownBrightness = value;
    const slider = this.shadowRoot.querySelector(".slider");
    const text = value ? `${value}%` : "Off";
    slider.style.setProperty("--brightness", `${value}%`);
    slider.setAttribute("aria-valuenow", value);
    slider.setAttribute("aria-valuetext", text);
    slider.querySelector(".value span").textContent = text;
  }

  // Shows the name, tints the controls with the light's color while it's on,
  // and dims them while it's unreachable. The options stay available, since
  // the dialog still shows an unreachable light's settings and history.
  _sync() {
    const entity = this._hass?.states?.[this.config.entity];
    const state = entity?.state;
    const attrs = entity?.attributes ?? {};
    const isOn = state === "on";
    this._unavailable = !state || ["unavailable", "unknown"].includes(state);
    const lightName = attrs.friendly_name ?? this.config.entity;
    const name = this.config.name || lightName;
    const root = this.shadowRoot;
    root.querySelector(".title").textContent = this.config.name ?? lightName;

    const controls = root.querySelector(".controls");
    controls.classList.toggle("inactive", this._unavailable);
    controls.classList.toggle("on", isOn);
    if (isOn && attrs.rgb_color) controls.style.setProperty("--light", `rgb(${attrs.rgb_color})`);
    else controls.style.removeProperty("--light");

    const power = root.querySelector(".power");
    power.disabled = this._unavailable;
    power.setAttribute("aria-pressed", String(isOn));
    power.setAttribute("aria-label", `Turn ${name} ${isOn ? "off" : "on"}`);
    root.querySelector(".options").setAttribute("aria-label", `${name} options`);

    // An on/off-only light has no brightness to set
    const modes = attrs.supported_color_modes;
    const slider = root.querySelector(".slider");
    slider.hidden = !!modes && modes.every((m) => m === "onoff");
    slider.tabIndex = this._unavailable ? -1 : 0;

    if (this._dragging) return;
    const brightness = isOn ? Math.max(1, Math.round(((attrs.brightness ?? 255) / 255) * 100)) : 0;
    const pending = this._pending;
    if (pending && Date.now() < pending.until && Math.abs(pending.value - brightness) > 1) {
      this._showBrightness(pending.value);
    } else {
      this._pending = null;
      this._showBrightness(brightness);
    }
  }

  _call(service, data = {}) {
    this._hass?.callService("light", service, data, { entity_id: this.config.entity });
    haptic(this);
  }

  getCardSize() {
    return 3;
  }
}

registerCard("light-card", LightCard, {
  name: "Light",
  description: "On/off, brightness and the full light options for a light",
});
