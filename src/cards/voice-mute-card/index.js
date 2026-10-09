import { Microphone, MicrophoneSlash } from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

// The mute switch's domain; on means muted
const DOMAINS = ["switch", "input_boolean"];

class VoiceMuteCard extends HTMLElement {
  setConfig(config) {
    if (!DOMAINS.includes(config.entity?.split(".")[0])) {
      throw new Error("Set entity to the voice assistant's mute switch, e.g. switch.living_room_jabra_mute");
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
        <div class="mic" aria-hidden="true">${icon(Microphone)}${icon(MicrophoneSlash)}</div>
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

  // Shows the name and whether the mic is muted, and dims the card while the
  // voice assistant is unreachable
  _sync() {
    const entity = this._hass?.states?.[this.config.entity];
    const state = entity?.state;
    const muted = state === "on";
    this._unavailable = !state || ["unavailable", "unknown"].includes(state);
    const deviceName = this._deviceName(entity);
    const root = this.shadowRoot;
    root.querySelector(".title").textContent = this.config.name ?? deviceName;
    root.querySelector(".status").textContent = this._unavailable ? "Unavailable" : muted ? "Muted" : "Listening";

    const card = root.querySelector("ha-card");
    card.classList.toggle("muted", muted);
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
