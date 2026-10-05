# Light

A bulb and the name of a light, with a key for its full options, then a key for
your favorite colors and a brightness slider. Tap anywhere else on the card to turn
the light on or off. Works with any `light` entity, such as a WiZ, Hue or LIFX bulb.

## Usage

```yaml
type: custom:light-card
entity: light.bedroom
```

## Options

| Option   | Type   | Default          | Description                                                            |
| -------- | ------ | ---------------- | ---------------------------------------------------------------------- |
| `entity` | string | required         | The light to control.                                                  |
| `name`   | string | the light's name | Title above the controls, next to the options key, e.g. `Bedroom Light`. Set it to `""` to hide it; the options key stays. |

## Behavior

- **Tap anywhere on the card** to toggle the light, except on the brightness
  bar and the two keys, which do their own thing. Turning it on
  brings back its last brightness. While it's on, the bulb above the name
  fills in and the whole card takes the light's color: the bulb, the color
  key's dot and the bar in it, and the card and keys in dimmer tints of it.
  A light that doesn't report a color, such as a dimmable white bulb, just
  brightens the card.
- **Tap the color key** to switch to the next of the light's
  favorite colors. After the last favorite it goes back to the first. While
  the light is off, it just turns it on in the color it had. Its dot shows the
  light's color while it's on. The key only shows once the light has favorites.
- **Tap the sliders key** next to the name to open Home Assistant's dialog for
  the light. That's where you pick a color or one of your favorite colors,
  start an effect, or change its settings. Favorites are set up in that dialog too.
- **Drag or tap the brightness bar.** The new brightness is sent when you let
  go. Dragging all the way to the left turns the light off; dragging right from
  off turns it on at that brightness.
- A vertical swipe on the bar scrolls the page rather than changing the brightness.
- With a keyboard, **Enter** or **Space** on the bar toggles the light, the
  arrow keys move the brightness 5% at a time, **Home** turns the light off
  and **End** sets full brightness.
- For a light that can only turn on and off, the bar is a switch: full while
  it's on, empty while it's off.
- Favorites you add, remove or reorder in Home Assistant's dialog show up on
  the card straight away.
- While the light is `unavailable` or missing, the color key and bar dim, and
  tapping the card does nothing. The options key still works.
- Every press asks the Home Assistant app for a light haptic.

## Examples

### Custom name

```yaml
type: custom:light-card
entity: light.wiz_rgbw_tunable_1a2b3c
name: Bedroom Light
```
