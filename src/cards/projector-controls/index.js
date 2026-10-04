import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  Power,
  Record4,
  Undo,
  VolumeLow,
  VolumeUp3,
} from "../../shared/icons.js";
import { createRoot, css, haptic, icon, registerCard } from "../../shared/card.js";
import styles from "./styles.css?inline";

const sheet = css(styles);

class ProjectorControls extends HTMLElement {
  setConfig(config) {
    this.config = {
      entity: "remote.projector",
      on_entity: "button.projector_on",
      power_entity: "media_player.projector",
      ...config,
    };
    if (!this.shadowRoot) this._build();
    this._syncPower();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot) this._syncPower();
  }

  // While the projector is off or unreachable: show "on" and dim the controls.
  // Otherwise: show "off" and enable them.
  _syncPower() {
    const state = this._hass?.states?.[this.config.power_entity]?.state;
    const isOff =
      !state || ["off", "unavailable", "unknown", "standby"].includes(state);
    const root = this.shadowRoot;
    root.querySelector(".on").hidden = !isOff;
    root.querySelector(".off").hidden = isOff;
    root.querySelectorAll(".side, .left").forEach((el) => {
      el.classList.toggle("inactive", isOff);
    });
    root.querySelectorAll("button[data-cmd]").forEach((b) => {
      b.disabled = isOff;
    });
  }

  _build() {
    const key = (cmd, Icon, label) =>
      `<button class="key" data-cmd="${cmd}" aria-label="${label}">${icon(Icon)}</button>`;
    const arrow = (cmd, Icon, label) =>
      `<button data-cmd="${cmd}" aria-label="${label}">${icon(Icon)}</button>`;

    const root = createRoot(
      this,
      sheet,
      `<ha-card>
        <div class="box"><div class="wrap">
          <button class="key power on" data-action="on">
            ${icon(Power)}Projector on
          </button>
          <button class="key power off danger" data-action="off">
            ${icon(Power)}Projector off
          </button>
          <div class="side">
            ${key("HOME", Home, "Home")}
            ${key("BACK", Undo, "Back")}
            ${key("VOLUME_UP", VolumeUp3, "Volume up")}
            ${key("VOLUME_DOWN", VolumeLow, "Volume down")}
          </div>
          <div class="left">
            <div class="dpad">
              <span></span>${arrow("DPAD_UP", ChevronUp, "Up")}<span></span>
              ${arrow("DPAD_LEFT", ChevronLeft, "Left")}<span></span>${arrow("DPAD_RIGHT", ChevronRight, "Right")}
              <span></span>${arrow("DPAD_DOWN", ChevronDown, "Down")}<span></span>
            </div>
            <button class="key select" data-cmd="DPAD_CENTER" data-hold="0.5" aria-label="Select">
              ${icon(Record4)}
            </button>
          </div>
        </div></div>
      </ha-card>`,
    );

    root.querySelectorAll("button").forEach((b) => {
      const stop = () => clearTimeout(this._timer);
      b.addEventListener("pointerdown", () => {
        stop();
        this._held = false;
        if (b.dataset.hold) {
          // Long press on select
          this._timer = setTimeout(() => {
            this._held = true;
            this._send(b.dataset.cmd, Number(b.dataset.hold));
          }, 500);
        }
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
        b.addEventListener(t, stop),
      );
      // A click only fires when the finger goes down and up on the same button,
      // so sliding across the pad never sends anything.
      b.addEventListener("click", () => {
        if (this._held) return (this._held = false);
        if (b.dataset.action === "on") {
          // Presses the button entity that broadcasts the Bluetooth wake signal
          this._call("button", "press", {}, this.config.on_entity);
        } else if (b.dataset.action === "off") {
          this._call("media_player", "turn_off", {}, this.config.power_entity);
        } else {
          this._send(b.dataset.cmd);
        }
      });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    });
  }

  _send(command, holdSecs) {
    const data = { command };
    if (holdSecs) data.hold_secs = holdSecs;
    this._call("remote", "send_command", data, this.config.entity);
  }

  _call(domain, service, data, entityId) {
    this._hass?.callService(domain, service, data, { entity_id: entityId });
    haptic(this);
  }

  getCardSize() {
    return 6;
  }
}

registerCard("projector-controls", ProjectorControls, {
  name: "Projector Controls",
  description:
    "Arrow pad, select, home, back, volume and power for the projector",
});
