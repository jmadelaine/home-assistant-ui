// The playground's Theme pages: tokens from src/shared/theme.css, icons from
// src/shared/icons.js, and the shared classes. Rendered in a shadow root with
// the theme adopted, exactly like a card.
import themeCss from "../src/shared/theme.css?raw";
import * as icons from "../src/shared/icons.js";
import { createRoot, css, icon } from "../src/shared/card.js";

export const VIEWS = {
  colors: "Colors",
  sizes: "Sizes & type",
  icons: "Icons",
  classes: "Classes",
};

// Reads the groups in theme.css's :host block. A comment line starts a group;
// anything after its first sentence is shown as a note.
function tokenGroups() {
  const host = themeCss.match(/:host\s*{([\s\S]*?)\n}/)[1];
  const groups = [];
  for (const line of host.split("\n").map((l) => l.trim())) {
    const heading = line.match(/^\/\*\s*(.+?)\s*\*\/$/);
    if (heading) {
      const [title, ...note] = heading[1].split(". ");
      groups.push({ title, note: note.join(". "), tokens: [] });
      continue;
    }
    const token = line.match(/^(--[\w-]+):\s*(.+);$/);
    if (token && groups.length) groups.at(-1).tokens.push({ name: token[1], value: token[2] });
  }
  return groups;
}

const styles = css(`
  :host { color: var(--primary-text-color); }
  section + section { margin-top: 32px; }
  h2 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  .note { margin: 0 0 12px; font-size: 13px; color: var(--secondary-text-color); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
           color: var(--secondary-text-color); overflow-wrap: anywhere; }

  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .swatch { display: grid; gap: 2px; padding: 8px; border: 1px solid var(--divider-color);
            border-radius: 12px; background: var(--card-background-color); }
  .chip { height: 56px; border-radius: 8px; margin-bottom: 6px;
          box-shadow: inset 0 0 0 1px var(--divider-color); }

  .rows { display: grid; border: 1px solid var(--divider-color); border-radius: 12px;
          background: var(--card-background-color); overflow: hidden; }
  .row { display: grid; grid-template-columns: 200px minmax(0, 1fr) minmax(0, 1fr);
         align-items: center; gap: 16px; padding: 10px 14px; }
  .row + .row { border-top: 1px solid var(--divider-color); }
  .bar { height: 12px; border-radius: 3px; background: var(--accent); }
  .shape { width: 56px; height: 40px; background: var(--fill); }

  .icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px;
           --icon-size: 32px; }
  .icon { display: grid; justify-items: center; gap: 8px; padding: 14px 6px 10px; }
  .icon code { font-size: 11px; }

  .demos { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .demo { display: grid; gap: 10px; align-content: start; padding: 12px; border: 1px solid var(--divider-color);
          border-radius: 12px; background: var(--card-background-color); }
  .demo p { margin: 0; font-size: 13px; color: var(--secondary-text-color); }
  .sample { display: flex; gap: 8px; align-items: center; min-height: 56px; }
  .sample .key { width: 56px; height: 56px; }
  .sample .wide { width: auto; padding: 0 16px; grid-auto-flow: column; gap: 8px; }
  .sample .surface { padding: 12px 16px; }

  @media (max-width: 700px) {
    .row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  }
`);

class ThemePage extends HTMLElement {
  static observedAttributes = ["view"];

  connectedCallback() {
    if (!this.shadowRoot) createRoot(this, styles, "");
    this.render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.render();
  }

  // Resolved value of a token, after any var() it refers to
  resolve(name) {
    return getComputedStyle(this).getPropertyValue(name).trim();
  }

  isColor(name) {
    return CSS.supports("color", this.resolve(name));
  }

  render() {
    const view = this.getAttribute("view");
    const groups = tokenGroups();
    const colorGroups = groups.filter((g) => g.tokens.every((t) => this.isColor(t.name)));
    const sizeGroups = groups.filter((g) => !colorGroups.includes(g));

    const html = {
      colors: () => colorGroups.map((g) => this.section(g, this.swatches(g))).join(""),
      sizes: () => sizeGroups.map((g) => this.section(g, this.rows(g))).join(""),
      icons: () => this.icons(),
      classes: () => this.classes(),
    }[view];
    this.shadowRoot.innerHTML = html ? html() : "";
  }

  section({ title, note }, body) {
    return `<section><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ""}${body}</section>`;
  }

  // The declared value, plus what it resolves to when that differs
  values({ name, value }) {
    const resolved = this.resolve(name);
    return resolved && resolved !== value
      ? `<span class="value">${resolved}</span><span class="value">${value}</span>`
      : `<span class="value">${value}</span>`;
  }

  swatches(group) {
    const cells = group.tokens.map(
      (t) => `<div class="swatch">
        <div class="chip" style="background: var(${t.name})"></div>
        <code>${t.name}</code>${this.values(t)}
      </div>`,
    );
    return `<div class="swatches">${cells.join("")}</div>`;
  }

  rows(group) {
    const sample = ({ name }) => {
      if (name.includes("opacity")) return `<span style="opacity: var(${name})">Secondary text</span>`;
      if (name.includes("font-size")) return `<span style="font-size: var(${name})">Rain from 15:00</span>`;
      if (name.includes("font-weight")) return `<span style="font-weight: var(${name})">Medium weight</span>`;
      if (name.includes("radius")) return `<div class="shape" style="border-radius: var(${name})"></div>`;
      if (name === "--icon-size") return icon(icons.Sun);
      return `<div class="bar" style="width: var(${name})"></div>`;
    };
    const cells = group.tokens.map(
      (t) => `<div class="row">
        <div>${sample(t)}</div>
        <code>${t.name}</code>
        <div>${this.values(t)}</div>
      </div>`,
    );
    return `<div class="rows">${cells.join("")}</div>`;
  }

  icons() {
    const cells = Object.entries(icons).map(
      ([name, Icon]) => `<div class="icon surface">${icon(Icon)}<code>${name}</code></div>`,
    );
    return this.section(
      {
        title: "Icons",
        note: "Every icon the cards use, from src/shared/icons.js. In a template: ${icon(Name)}. Size with --icon-size; color follows the text.",
      },
      `<div class="icons">${cells.join("")}</div>`,
    );
  }

  classes() {
    const { Home, Power, Undo, ChevronUp } = icons;
    const demo = (name, note, sample) =>
      `<div class="demo"><code>${name}</code><div class="sample">${sample}</div><p>${note}</p></div>`;
    return this.section(
      { title: "Classes", note: "Shared classes from src/shared/theme.css. Press the buttons to see their states." },
      `<div class="demos">
        ${demo("button", "Every button is reset: no chrome, touch-friendly, with press and focus states.", `<button style="width:56px;height:56px;border-radius:var(--radius)">${icon(ChevronUp)}</button>`)}
        ${demo(".key", "A filled, rounded button.", `<button class="key">${icon(Home)}</button><button class="key">${icon(Undo)}</button>`)}
        ${demo(".danger", "Destructive actions, e.g. turning a device off.", `<button class="key danger wide">${icon(Power)}Turn off</button>`)}
        ${demo(".surface", "The same fill and corners for anything that isn't a button.", `<div class="surface">A panel</div>`)}
        ${demo(".secondary", "Dimmed text: labels, dates, units.", `<span>Main text</span><span class="secondary">secondary text</span>`)}
        ${demo(".inactive", "Dims a section and blocks presses, e.g. while a device is off.", `<div class="sample inactive"><button class="key">${icon(Home)}</button><button class="key">${icon(Undo)}</button></div>`)}
      </div>`,
    );
  }
}

customElements.define("theme-page", ThemePage);
