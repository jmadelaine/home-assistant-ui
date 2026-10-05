import "./ha-elements.js";
import { VIEWS } from "./theme-page.js";
import "../src/index.js";
import { marked } from "marked";
import { parse } from "yaml";
import { createMockHass } from "./mock-hass.js";

const readmes = import.meta.glob("../src/cards/*/README.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const previews = import.meta.glob("../src/cards/*/preview.js", {
  import: "default",
  eager: true,
});

// Every ```yaml block in a card's README doubles as a preset, titled by the heading above it.
function examplesFrom(readme) {
  const examples = [];
  let heading = "Example";
  for (const token of marked.lexer(readme)) {
    if (token.type === "heading") heading = token.text;
    else if (token.type === "code" && token.lang === "yaml") {
      examples.push({ title: heading, yaml: `${token.text}\n` });
    }
  }
  return examples;
}

const cards = (window.customCards ?? []).map((info) => {
  const readme = readmes[`../src/cards/${info.type}/README.md`] ?? "";
  return {
    ...info,
    readme,
    examples: examplesFrom(readme),
    preview: previews[`../src/cards/${info.type}/preview.js`] ?? {},
  };
});

// localStorage can be unavailable (private windows, blocked storage)
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

const $ = (id) => document.getElementById(id);

let current; // the selected entry from `cards`
let mock; // its mock hass
let cardEl; // the mounted card element

// Sidebar

const link = (href, title, subtitle) => {
  const a = document.createElement("a");
  a.href = href;
  a.append(document.createElement("strong"));
  a.firstChild.textContent = title;
  if (subtitle) {
    a.append(document.createElement("span"));
    a.lastChild.textContent = subtitle;
  }
  return a;
};

$("theme-list").replaceChildren(
  ...Object.entries(VIEWS).map(([view, title]) => link(`#theme/${view}`, title)),
);

$("card-list").replaceChildren(
  ...cards.map((card) => link(`#${card.type}`, card.name ?? card.type, card.description)),
);

// Marks the sidebar link for the current page
const markCurrent = (href) => {
  document.querySelectorAll(".sidebar a").forEach((a) => {
    if (a.getAttribute("href") === href) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
};

// Theme pages: #theme/<view>
function showTheme(view) {
  view = view in VIEWS ? view : "colors";
  markCurrent(`#theme/${view}`);
  $("card-name").textContent = VIEWS[view];
  $("card-type").textContent = view === "icons" ? "src/shared/icons.js" : "src/shared/theme.css";
  document.title = `${VIEWS[view]} · Card Playground`;
  $("theme-page").setAttribute("view", view);
}

function select(type) {
  current = cards.find((c) => c.type === type) ?? cards[0];
  if (!current) {
    $("card-name").textContent = "No cards found";
    return;
  }

  markCurrent(`#${current.type}`);
  $("card-name").textContent = current.name ?? current.type;
  $("card-type").textContent = `custom:${current.type}`;
  document.title = `${current.name ?? current.type} · Card Playground`;

  renderDocs();
  renderExamples();

  const m = createMockHass(current.preview, {
    darkMode: $("theme").value === "dark",
    // Ignore updates from a card we've since switched away from
    onUpdate: (hass) => mock === m && applyHass(hass),
    onCall: ({ domain, service, data, target }) =>
      log("service", `${domain}.${service}`, { ...data, ...target }),
    onApi: ({ method, path }) => log("api", method, decodeURIComponent(path)),
    onWs: ({ type, ...data }) => log("ws", type, data),
  });
  mock = m;
  renderEntities();
  $("log").replaceChildren();

  $("yaml").value =
    store.get(`yaml:${current.type}`) ??
    current.examples[0]?.yaml ??
    `type: custom:${current.type}\n`;
  mount();
}

// Card

function mount() {
  $("card-host").replaceChildren();
  cardEl = null;
  showNotice();

  let config;
  try {
    config = parse($("yaml").value);
  } catch (err) {
    return showNotice("error", `YAML: ${err.message}`);
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return showNotice("error", "The config must be a YAML mapping.");
  }

  // Same order as Home Assistant: create, setConfig, hass, then attach
  const el = document.createElement(current.type);
  try {
    el.setConfig(config);
  } catch (err) {
    return showNotice("error", `setConfig threw: ${err.message}`);
  }
  el.hass = mock.hass;
  $("card-host").append(el);
  cardEl = el;

  if (config.type !== `custom:${current.type}`) {
    showNotice("warn", `In Home Assistant, type must be custom:${current.type}`);
  }
}

function applyHass(hass) {
  if (cardEl) cardEl.hass = hass;
  syncEntities(hass);
}

function showNotice(kind, text) {
  const notice = $("notice");
  notice.hidden = !kind;
  notice.className = `notice ${kind ?? ""}`;
  notice.textContent = text ?? "";
}

// Config editor

function loadYaml(yaml) {
  $("yaml").value = yaml;
  store.set(`yaml:${current.type}`, yaml);
  mount();
}

let typing;
$("yaml").addEventListener("input", () => {
  clearTimeout(typing);
  typing = setTimeout(() => loadYaml($("yaml").value), 250);
});

// Tab indents instead of leaving the editor
$("yaml").addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey) return;
  e.preventDefault();
  document.execCommand("insertText", false, "  ");
});

function renderExamples() {
  const placeholder = new Option("Load example…", "");
  placeholder.disabled = true;
  $("examples").replaceChildren(
    placeholder,
    ...current.examples.map((ex, i) => new Option(ex.title, i)),
  );
  $("examples").value = "";
}

$("examples").addEventListener("change", (e) => {
  loadYaml(current.examples[e.target.value].yaml);
  e.target.value = "";
});

// Docs

function renderDocs() {
  const docs = $("docs");
  docs.innerHTML = marked.parse(current.readme || "_This card has no README.md yet._");
  docs.querySelectorAll("pre > code.language-yaml").forEach((code) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "try";
    button.textContent = "Try it";
    button.addEventListener("click", () => {
      loadYaml(code.textContent);
      $("yaml").scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    code.parentElement.append(button);
  });
}

// Mock entities

function renderEntities() {
  const defs = current.preview.entities ?? {};
  const rows = Object.keys(mock.hass.states).map((id) => {
    const row = document.createElement("label");
    row.className = "entity";
    const name = document.createElement("code");
    name.textContent = id;
    name.title = id;

    const options = defs[id]?.options;
    let input;
    if (options) {
      input = document.createElement("select");
      input.append(...options.map((o) => new Option(o)));
    } else {
      input = document.createElement("input");
      input.spellcheck = false;
    }
    input.dataset.entity = id;
    input.addEventListener("change", () => {
      mock.setState(id, input.value);
      // A card that fetches only does so when mounted, so remount it to fetch again
      if (current.preview.fetch) mount();
    });

    row.append(name, input);
    return row;
  });

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "This card has no preview.js entities.";
    rows.push(empty);
  }
  $("entities").replaceChildren(...rows);
  syncEntities(mock.hass);
}

function syncEntities(hass) {
  $("entities").querySelectorAll("[data-entity]").forEach((input) => {
    if (input === document.activeElement) return;
    const state = hass.states[input.dataset.entity]?.state ?? "";
    if (input.tagName === "SELECT" && ![...input.options].some((o) => o.value === state)) {
      input.add(new Option(state));
    }
    input.value = state;
  });
}

// Log

function log(kind, text, detail) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString([], { hourCycle: "h23" });
  const label = document.createElement("span");
  label.className = kind;
  label.textContent = text;
  const extra = document.createElement("span");
  extra.className = "detail";
  extra.textContent = detail === undefined ? "" : JSON.stringify(detail);
  item.append(time, label, extra);

  $("log").prepend(item);
  while ($("log").children.length > 100) $("log").lastElementChild.remove();
}

$("clear-log").addEventListener("click", () => $("log").replaceChildren());

// Events cards fire at the Home Assistant frontend
for (const type of ["haptic", "hass-more-info", "hass-action", "hass-notification", "ll-custom"]) {
  $("card-host").addEventListener(type, (e) => log("event", type, e.detail));
}

// preview.js can answer a card's fetch calls: `fetch(url, hass)` returns the
// JSON body, or undefined to let the request through to the network.
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const handler = current?.preview.fetch;
  if (!handler) return realFetch(input, init);
  const url = String(input instanceof Request ? input.url : input);
  const body = handler(url, mock.hass);
  log("fetch", body === undefined ? "network" : "mock", url);
  if (body === undefined) return realFetch(input, init);
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      Expires: new Date(Date.now() + 30 * 60e3).toUTCString(),
    },
  });
};

// Toolbar

const width = Number(store.get("width")) || 500;
$("width").value = width;
const applyWidth = () => {
  $("card-host").style.width = `${$("width").value}px`;
  $("width-value").textContent = `${$("width").value}px`;
};
applyWidth();
$("width").addEventListener("input", () => {
  applyWidth();
  store.set("width", $("width").value);
});

$("theme").value =
  store.get("theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const applyTheme = () => {
  document.documentElement.dataset.theme = $("theme").value;
  mock?.setDarkMode($("theme").value === "dark");
  // Resolved color values change with the theme
  if (!$("theme-page").hidden) $("theme-page").render?.();
};
applyTheme();
$("theme").addEventListener("change", () => {
  applyTheme();
  store.set("theme", $("theme").value);
});

// Routing: #<card-type> or #theme/<view>

function route() {
  const hash = location.hash.slice(1);
  const isTheme = hash.startsWith("theme/");
  $("theme-page").hidden = !isTheme;
  $("card-view").hidden = isTheme;
  $("width-control").hidden = isTheme;
  if (isTheme) showTheme(hash.slice("theme/".length));
  else select(hash);
}

addEventListener("hashchange", route);
route();
