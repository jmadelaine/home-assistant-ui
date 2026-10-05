import { Bulb2, Setting4, Sun } from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

const KEY_STEP = 5; // percent per arrow key on the slider
// After a change, the slider keeps showing it until the light reports back,
// so it doesn't jump to the old brightness in between
const PENDING_FOR = 3000;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Whether the light is showing a favorite color, e.g. { rgb_color: [255, 110, 84] }
// or { color_temp_kelvin: 2700 }. The light reports colors back slightly
// changed, so they only need to be close.
function showsFavorite(attrs, favorite) {
  if (favorite.color_temp_kelvin != null) {
    return attrs.color_mode === "color_temp" &&
      Math.abs(attrs.color_temp_kelvin - favorite.color_temp_kelvin) <= 50;
  }
  // A light on a color temperature also reports it as an rgb_color
  if (attrs.color_mode === "color_temp") return false;
  const [key, value] = Object.entries(favorite)[0] ?? [];
  const now = attrs[key];
  return Array.isArray(now) && value.every((v, i) => Math.abs(v - now[i]) <= 3);
}

class LightCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity?.startsWith("light.")) {
      throw new Error("Set entity to a light, e.g. light.bedroom");
    }
    const entityChanged = config.entity !== this.config?.entity;
    this.config = { ...config };
    if (!this.shadowRoot) this._build();
    if (entityChanged && this._unwatch) this._loadFavorites();
    this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    this._watchFavorites();
    if (this.shadowRoot) this._sync();
  }

  connectedCallback() {
    this._watchFavorites();
  }

  disconnectedCallback() {
    this._unwatch?.then((unsubscribe) => unsubscribe?.());
    this._unwatch = undefined;
  }

  // Favorite colors are kept in the light's entity registry entry, not its
  // state. Loads them, then again whenever the entry changes, e.g. after
  // editing favorites in Home Assistant's dialog.
  _watchFavorites() {
    if (this._unwatch || !this.isConnected || !this._hass || !this.config) return;
    this._unwatch = Promise.resolve(
      this._hass.connection?.subscribeEvents((e) => {
        if (e.data.entity_id === this.config.entity) this._loadFavorites();
      }, "entity_registry_updated"),
    ).catch(() => undefined);
    this._loadFavorites();
  }

  async _loadFavorites() {
    const entity = this.config.entity;
    let favorites = [];
    try {
      const entry = await this._hass.callWS({ type: "config/entity_registry/get", entity_id: entity });
      favorites = entry.options?.light?.favorite_colors ?? [];
    } catch {
      // Not in the registry, e.g. a light without a unique ID: no favorites
    }
    if (entity !== this.config.entity) return; // switched lights meanwhile
    this._favorites = favorites;
    this._sync();
  }

  // Switches the light to the favorite after the one it's showing. If it isn't
  // showing one, carries on from the last one picked here. While it's off,
  // just turns it on as it was.
  _nextFavorite() {
    const favorites = this._favorites;
    const entity = this._hass?.states?.[this.config.entity];
    if (entity?.state !== "on") return this._call("turn_on");
    const shown = favorites.findIndex((f) => showsFavorite(entity.attributes, f));
    const next = ((shown >= 0 ? shown : this._favoriteIndex ?? -1) + 1) % favorites.length;
    this._favoriteIndex = next;
    this._call("turn_on", favorites[next]);
  }

  _build() {
    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="header">
          <div class="bulb" aria-hidden="true">${icon(Bulb2)}${icon(Bulb2, "Filled")}</div>
          <button class="options">${icon(Setting4)}</button>
          <div class="title"></div>
        </div>
        <div class="controls">
          <button class="key favorite" hidden><span class="swatch"></span></button>
          <div class="slider" tabindex="0" aria-describedby="slider-hint">
            <div class="fill"></div>
            <div class="value">${icon(Sun)}<span></span></div>
          </div>
          <span id="slider-hint" hidden>Press Enter to turn on or off</span>
        </div>
      </ha-card>`,
    );

    // A tap anywhere on the card toggles the light, except on its keys and the
    // brightness bar, and except the click a browser sends after a press on the bar
    const card = root.querySelector("ha-card");
    card.addEventListener("pointerdown", () => (this._slid = false));
    card.addEventListener("click", (e) => {
      if (this._slid || this._unavailable || e.target.closest("button")) return;
      this._call("toggle");
    });
    root.querySelector(".favorite").addEventListener("click", () => this._nextFavorite());
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
  //
  // A press is followed on the window rather than the slider, so it always
  // ends when the finger lifts, even if the slider loses hold of the pointer
  // along the way.
  _bindSlider(slider) {
    const valueAt = (e) => {
      const { left, width } = slider.getBoundingClientRect();
      return Math.round(clamp((e.clientX - left) / width, 0, 1) * 100);
    };
    const move = (e) => {
      if (e.pointerId === this._press?.id) this._showBrightness(valueAt(e));
    };
    const end = (e) => {
      if (e.pointerId !== this._press?.id) return;
      this._press = null;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      if (e.type === "pointerup") {
        this._slid = true;
        this._setBrightness(valueAt(e));
      } else {
        // The browser took the touch for a scroll: put the slider back
        this._sync();
      }
    };
    slider.addEventListener("pointerdown", (e) => {
      if (this._unavailable || this._onOff || this._press) return;
      slider.setPointerCapture(e.pointerId);
      this._press = { id: e.pointerId };
      this._showBrightness(valueAt(e));
      addEventListener("pointermove", move);
      addEventListener("pointerup", end);
      addEventListener("pointercancel", end);
    });
    slider.addEventListener("keydown", (e) => {
      if (this._unavailable) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.repeat) this._call("toggle");
        return;
      }
      if (this._onOff) return;
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
    const text = !value ? "Off" : this._onOff ? "On" : `${value}%`;
    slider.style.setProperty("--brightness", `${value}%`);
    if (!this._onOff) {
      slider.setAttribute("aria-valuenow", value);
      slider.setAttribute("aria-valuetext", text);
    }
    slider.querySelector(".value span").textContent = text;
  }

  // Shows the name, lights up the card and tints the controls with the light's
  // color while it's on, and dims the controls while it's unreachable. The options stay available, since
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

    const card = root.querySelector("ha-card");
    card.classList.toggle("unavailable", this._unavailable);
    card.classList.toggle("on", isOn);
    const controls = root.querySelector(".controls");
    controls.classList.toggle("inactive", this._unavailable);
    const colored = isOn && !!attrs.rgb_color;
    controls.classList.toggle("colored", colored);
    if (colored) controls.style.setProperty("--light", `rgb(${attrs.rgb_color})`);
    else controls.style.removeProperty("--light");
    root.querySelector(".options").setAttribute("aria-label", `${name} options`);

    const favorite = root.querySelector(".favorite");
    favorite.hidden = !this._favorites?.length;
    favorite.disabled = this._unavailable;
    favorite.setAttribute("aria-label", `Next favorite color for ${name}`);

    // An on/off-only light has no brightness to set: its bar is a switch,
    // full while it's on
    const modes = attrs.supported_color_modes;
    this._onOff = !!modes && modes.every((m) => m === "onoff");
    const slider = root.querySelector(".slider");
    slider.tabIndex = this._unavailable ? -1 : 0;
    slider.setAttribute("aria-label", this._onOff ? name : `${name} brightness`);
    if (this._onOff) {
      slider.setAttribute("role", "switch");
      slider.setAttribute("aria-checked", String(isOn));
      for (const a of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-valuetext"]) {
        slider.removeAttribute(a);
      }
    } else {
      slider.setAttribute("role", "slider");
      slider.setAttribute("aria-valuemin", "0");
      slider.setAttribute("aria-valuemax", "100");
      slider.removeAttribute("aria-checked");
    }

    if (this._press) return; // the slider shows the press until it ends
    if (this._onOff) return this._showBrightness(isOn ? 100 : 0);
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
