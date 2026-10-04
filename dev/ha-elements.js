// Stand-ins for the elements Home Assistant's frontend provides to cards.
// They only need to look close enough to the real ones to judge a design.
import * as mdi from "@mdi/js";

class HaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          box-sizing: border-box;
          background: var(--ha-card-background, var(--card-background-color, #fff));
          color: var(--primary-text-color);
          border-radius: var(--ha-card-border-radius, 12px);
          border: var(--ha-card-border-width, 1px) solid
            var(--ha-card-border-color, var(--divider-color, #e0e0e0));
          box-shadow: var(--ha-card-box-shadow, none);
          transition: all 0.3s ease-out;
        }
      </style>
      <slot></slot>`;
  }
}

// Renders "mdi:chevron-up" from the matching @mdi/js path (mdiChevronUp).
class HaIcon extends HTMLElement {
  static observedAttributes = ["icon"];
  #icon = "";

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        :host {
          display: inline-flex;
          flex: none;
          width: var(--mdc-icon-size, 24px);
          height: var(--mdc-icon-size, 24px);
          fill: currentColor;
          vertical-align: middle;
        }
        svg { width: 100%; height: 100%; display: block; }
      </style>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path></path></svg>`;
  }

  get icon() {
    return this.#icon;
  }

  set icon(value) {
    this.#icon = value ?? "";
    const name = this.#icon.replace(/^mdi:/, "");
    const key =
      "mdi" + name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
    const path = mdi[key];
    if (name && !path) console.warn(`ha-icon: unknown icon "${this.#icon}"`);
    this.shadowRoot.querySelector("path").setAttribute("d", path ?? "");
  }

  attributeChangedCallback(_name, _old, value) {
    this.icon = value;
  }
}

customElements.define("ha-card", HaCard);
customElements.define("ha-icon", HaIcon);
