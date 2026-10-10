import { Microphone, MicrophoneSlash } from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

// The mute switch's domain; on means muted
const DOMAINS = ["switch", "input_boolean"];

const unreachable = (state) => !state || ["unavailable", "unknown"].includes(state);

// What the assist satellite is doing, as shown under the name
const ACTIVITY = {
  idle: "Idle",
  listening: "Listening",
  processing: "Processing",
  responding: "Responding",
};

class VoiceMuteCard extends HTMLElement {
  setConfig(config) {
    if (!DOMAINS.includes(config.entity?.split(".")[0])) {
      throw new Error("Set entity to the voice assistant's mute switch, e.g. switch.living_room_jabra_mute");
    }
    if (config.satellite_entity != null && !config.satellite_entity.startsWith("assist_satellite.")) {
      throw new Error("Set satellite_entity to an assist satellite, e.g. assist_satellite.living_room_jabra");
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
      `<ha-card role="switch" tabindex="0">
        <div class="mic" aria-hidden="true">
          ${icon(Microphone)}${icon(MicrophoneSlash)}
          <div class="bars"><span></span><span></span><span></span><span></span><span></span></div>
        </div>
        <div class="text">
          <div class="title"></div>
          <div class="status secondary"></div>
        </div>
      </ha-card>`,
    );

    // A tap anywhere on the card, or Enter or Space on it, mutes or unmutes
    const card = root.querySelector("ha-card");
    card.addEventListener("click", () => this._toggle());
    card.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (!e.repeat) this._toggle();
    });
  }

  // The name of the device the switch is on, e.g. Living Room Jabra. Falls
  // back to the switch's own name when it isn't on a device.
  _deviceName(entity) {
    const deviceId = this._hass?.entities?.[this.config.entity]?.device_id;
    const device = deviceId && this._hass.devices?.[deviceId];
    return device?.name_by_user || device?.name || entity?.attributes.friendly_name || this.config.entity;
  }

  // The assist satellite: the one set in the config, or else the one on the
  // same device as the switch. The search runs again only when the entity
  // registry changes.
  _satellite() {
    if (this.config.satellite_entity) return this.config.satellite_entity;
    const entities = this._hass?.entities;
    if (!entities) return undefined;
    if (this._found?.entities !== entities || this._found.entity !== this.config.entity) {
      const deviceId = entities[this.config.entity]?.device_id;
      const id = deviceId
        ? Object.values(entities).find((e) => e.device_id === deviceId && e.entity_id.startsWith("assist_satellite."))?.entity_id
        : undefined;
      this._found = { entities, entity: this.config.entity, id };
    }
    return this._found.id;
  }

  // Shows the name, whether the mic is muted and, while it isn't, what the
  // assist satellite is doing. Greys out the mic while either is unreachable,
  // and dims the whole card while the mute switch is.
  _sync() {
    const entity = this._hass?.states?.[this.config.entity];
    const muted = entity?.state === "on";
    this._unavailable = unreachable(entity?.state);
    const deviceName = this._deviceName(entity);
    const root = this.shadowRoot;
    root.querySelector(".title").textContent = this.config.name ?? deviceName;

    // While unmuted, what the satellite is doing; just Unmuted without one
    const satellite = this._satellite();
    const activity = this._hass?.states?.[satellite]?.state;
    const offline = this._unavailable || (!!satellite && unreachable(activity));
    const status = offline ? "Unavailable" : muted ? "Muted" : (ACTIVITY[activity] ?? "Unmuted");
    root.querySelector(".status").textContent = status;

    const card = root.querySelector("ha-card");
    card.dataset.activity = !offline && !muted && Object.hasOwn(ACTIVITY, activity) ? activity : "";
    card.classList.toggle("muted", muted && !offline);
    card.classList.toggle("offline", offline);
    card.classList.toggle("unavailable", this._unavailable);
    card.tabIndex = this._unavailable ? -1 : 0;
    card.setAttribute("aria-label", `Mute ${this.config.name || deviceName}`);
    card.setAttribute("aria-checked", String(muted));
    card.setAttribute("aria-disabled", String(this._unavailable));
  }

  _toggle() {
    if (this._unavailable) return;
    const domain = this.config.entity.split(".")[0];
    this._hass?.callService(domain, "toggle", {}, { entity_id: this.config.entity });
    haptic(this);
  }

  getCardSize() {
    return 1;
  }
}

registerCard("voice-mute-card", VoiceMuteCard, {
  name: "Voice Mute",
  description: "Mute or unmute a voice assistant's microphone",
});
