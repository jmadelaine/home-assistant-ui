import themeCss from "./theme.css?inline";

// Parses CSS once so every instance of a card shares the same stylesheet.
export const css = (text) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(text);
  return sheet;
};

const theme = css(themeCss);

// Opens the card's shadow root with the shared theme followed by the card's own styles.
export function createRoot(host, styles, html) {
  const root = host.attachShadow({ mode: "open" });
  root.adoptedStyleSheets = [theme, styles];
  root.innerHTML = html;
  return root;
}

// Markup for a reicon icon, for use in templates: `${icon(Home)}`.
// Size it with --icon-size.
export const icon = (Icon, weight = "Outline") => Icon({ weight }).outerHTML;

// Asks the Home Assistant app to vibrate (no-op in a desktop browser).
export function haptic(host, type = "light") {
  host.dispatchEvent(
    new CustomEvent("haptic", { bubbles: true, composed: true, detail: type }),
  );
}

// Defines the element and lists it in the dashboard card picker.
// `type` is also the card's folder name and its YAML `type: custom:<type>`.
export function registerCard(type, element, { name, description }) {
  if (customElements.get(type)) return;
  customElements.define(type, element);
  window.customCards = window.customCards || [];
  window.customCards.push({ type, name, description });
}
