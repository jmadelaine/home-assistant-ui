# home-assistant-ui

Custom Lovelace cards with a shared look. Every card ships in one bundle,
`home-assistant-ui.js`.

| Card                                                        | Type                        |
| ----------------------------------------------------------- | --------------------------- |
| [Agenda](src/cards/agenda-card/README.md)                     | `custom:agenda-card`        |
| [Date & Time](src/cards/datetime-card/README.md)             | `custom:datetime-card`      |
| [Light](src/cards/light-card/README.md)                       | `custom:light-card`         |
| [Projector Controls](src/cards/projector-controls/README.md) | `custom:projector-controls` |
| [Server](src/cards/server-card/README.md)                     | `custom:server-card`        |
| [Voice Mute](src/cards/voice-mute-card/README.md)             | `custom:voice-mute-card`    |
| [Weather](src/cards/weather-card/README.md)                   | `custom:weather-card`       |

## Development

```sh
npm install
npm run dev
```

Open the URL Vite prints. The playground has:

- **A sidebar** with the **Theme** pages (colors, sizes and type, icons,
  classes) and every card.
- **A live preview** in Home Assistant's light or dark theme, at a width you set.
- **A YAML editor.** The card re-renders as you type and shows any YAML or
  `setConfig` errors. Your edits are kept per card in the browser; pick an
  entry from **Load example** to start again.
- **Mock entities** whose states you can change, to see how the card reacts.
- **A log** of the service calls, events (e.g. `haptic`) and fetches the card makes.
- **The card's docs** (its README). Each YAML block in them has a **Try it** button.

To try a card on your phone, run `npm run dev -- --host` and open the network URL.

## Installing in Home Assistant

1. `npm run build`
2. Copy `dist/home-assistant-ui.js` to `/config/www/` on your Home Assistant host.
3. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**. Enter URL
   `/local/home-assistant-ui.js?v=1` and choose type **JavaScript module**.
4. Add the cards to a dashboard with the YAML from each card's README.

Home Assistant caches resources heavily. After you copy a new build, bump `?v=`
in the resource URL and reload.

## Layout

```
src/
  index.js              bundle entry; imports every src/cards/*/index.js
  shared/
    theme.css           shared tokens and classes, adopted by every card
    icons.js            every icon the cards use
    card.js             helpers: createRoot, css, icon, haptic, registerCard
  cards/<type>/
    index.js            the custom element
    styles.css          its styles (on top of theme.css)
    README.md           docs: options table and YAML examples
    preview.js          mock entities and responses for the playground (optional)
dev/                    the playground: mock hass, ha-card, ha-icon, Theme pages
index.html              playground page
```

## Adding a card

1. Create `src/cards/<type>/`. The folder name must match the element's tag and
   its YAML `type: custom:<type>`.
2. In `index.js`, build the shadow root with `createRoot(this, sheet, html)` so
   the shared theme applies. For icons, import them from `src/shared/icons.js`
   and put them in templates with `${icon(Home)}`. To use a new
   [reicon](https://reicon.dev) icon, add it to `icons.js` first. Then call
   `registerCard("<type>", Element, { name, description })`. The bundle and the
   playground pick it up automatically.
3. Write `README.md` with a description, a **Usage** YAML block, an **Options**
   table and any **Examples**. Every `yaml` code block becomes a preset in the
   playground, named after the heading above it.
4. If the card reads entities or fetches data, add `preview.js`:

   ```js
   export default {
     entities: {
       "light.desk": "on",
       "media_player.tv": { state: "off", options: ["on", "off", "unavailable"] },
     },
     // Optional. turn_on, turn_off and toggle already work for any domain.
     services: {
       "button.press": ({ entityIds, setState, data, states }) => {},
     },
     // Optional. Return a JSON body to answer the card's fetch(url),
     // or undefined to let the request through to the network.
     // The card is remounted (and fetches again) when you change a mock entity.
     fetch: (url, hass) => undefined,
     // Optional. Devices and the entities on them, for hass.devices and hass.entities.
     devices: { desk_lamp: { name: "Desk Lamp", entities: ["light.desk"] } },
   };
   ```

## Shared theme

`src/shared/theme.css` holds the tokens (colors, spacing, radius, type, icon
size) and the shared classes. Colors come from the active Home Assistant theme
where they can. `src/shared/icons.js` lists every icon.

Use the tokens, classes and icons so the cards stay consistent. The
playground's **Theme** pages show all of them, read straight from those files.
To add a token, put it in a group in the `:host` block of `theme.css`. A
`/* Group */` comment line starts a group, and the Theme pages pick it up.
