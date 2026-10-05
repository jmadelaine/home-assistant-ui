# Light

The name of a light with a key for its full options, then an on/off key and a
brightness slider. Works with any `light` entity, such as a WiZ, Hue or LIFX bulb.

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

- **Tap the bulb** to toggle the light. While it's on, the bulb fills in, and
  its key and the slider's bar take the light's color.
- **Tap the sliders key** next to the name to open Home Assistant's dialog for
  the light. That's where you pick a color or one of your favorite colors,
  start an effect, or change its settings. Favorites are set up in that dialog too.
- **Drag or tap the brightness bar.** The new brightness is sent when you let
  go. Dragging all the way to the left turns the light off; dragging up from
  off turns it on at that brightness.
- A vertical swipe on the bar scrolls the page rather than changing the brightness.
- With a keyboard, the arrow keys move the brightness 5% at a time; **Home**
  turns the light off and **End** sets full brightness.
- A light that can only turn on and off has no slider.
- While the light is `unavailable` or missing, the on/off key and slider dim.
  The options key still works.
- Every press asks the Home Assistant app for a light haptic.

## Examples

### Custom name

```yaml
type: custom:light-card
entity: light.wiz_rgbw_tunable_1a2b3c
name: Bedroom Light
```
