# Light

The name of a light, with a key for its full options, then a power key and a
brightness slider. Tap the power key, or anywhere else on the card, to turn the
light on or off. Works with any `light` entity, such as a WiZ, Hue or LIFX bulb.

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

- **Tap the power key**, or anywhere else on the card, to toggle the light,
  except on the brightness bar and the options key, which do their own thing.
  Turning it on brings back its last brightness and color. The key shows a
  bulb: a greyed outline while the light is off, filled while it's on. While
  it's on, the whole card takes the light's color: the bulb and the bar in it,
  and the card and keys in dimmer tints of it. A light that doesn't report a
  color, such as a dimmable white bulb, just brightens the card.
- **Tap the sliders key** next to the name to open Home Assistant's dialog for
  the light. That's where you pick a color or one of your favorite colors,
  start an effect, or change its settings.
- **Drag or tap the brightness bar.** It moves in 5% steps, and the new
  brightness is sent when you let go. Dragging all the way to the left turns the light off; dragging right from
  off turns it on at that brightness.
- A vertical swipe on the bar scrolls the page rather than changing the brightness.
- With a keyboard, **Enter** or **Space** on the bar toggles the light, the
  arrow keys move the brightness 5% at a time, **Home** turns the light off
  and **End** sets full brightness.
- For a light that can only turn on and off, the bar is a switch: full while
  it's on, empty while it's off.
- While the light is `unavailable` or missing, the power key and bar dim, and
  tapping the card does nothing. The options key still works.
- Every press asks the Home Assistant app for a light haptic.

## Examples

### Custom name

```yaml
type: custom:light-card
entity: light.wiz_rgbw_tunable_1a2b3c
name: Bedroom Light
```
