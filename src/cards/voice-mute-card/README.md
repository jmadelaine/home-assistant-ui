# Voice Mute

A voice assistant's mic, with the name of its device, e.g. **Living Room
Jabra**. Tap the card to mute or unmute it. Works with the mute switch an
ESPHome voice assistant has, such as a Linux Voice Assistant or a Home
Assistant Voice Preview Edition.

## Usage

```yaml
type: custom:voice-mute-card
entity: switch.living_room_jabra_mute
```

## Options

| Option   | Type   | Default           | Description                                                     |
| -------- | ------ | ----------------- | --------------------------------------------------------------- |
| `entity` | string | required          | The mute switch: a `switch` or `input_boolean` that's on while muted. |
| `name`   | string | the device's name | Title next to the mic, e.g. `Living Room`. Set it to `""` to hide it. |

## Behavior

- **Tap anywhere on the card** to mute or unmute. With a keyboard, **Enter** or
  **Space** does the same.
- While it's listening, the mic is in the accent color and the card reads
  **Listening**.
- While it's muted, the mic is crossed out, the card takes a tint of the danger
  color and reads **Muted**, so a muted assistant stands out on the dashboard.
- The name comes from the device the switch is on, as Home Assistant shows it
  on the device's page. A switch that isn't on a device shows its own name.
- While the switch is `unavailable` or missing, the card dims, reads
  **Unavailable**, and tapping it does nothing.
- Every tap asks the Home Assistant app for a light haptic.

## Examples

### Custom name

```yaml
type: custom:voice-mute-card
entity: switch.living_room_jabra_mute
name: Living Room
```
