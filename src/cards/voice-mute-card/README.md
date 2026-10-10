# Voice Mute

A voice assistant's mic, with the name of its device, e.g. **Living Room
Jabra**, and what it's doing: idle, listening, processing or responding. Tap
the card to mute or unmute it. Works with the mute switch an
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
| `satellite_entity` | string | the one on the same device | The `assist_satellite` whose state shows under the name. Only needed when it isn't on the same device as the mute switch. |

## Behavior

- **Tap anywhere on the card** to mute or unmute. With a keyboard, **Enter** or
  **Space** does the same.
- While it's unmuted, the card shows what the assist satellite is doing:
  **Idle** while it waits for the wake word, then **Listening**,
  **Processing** and **Responding** as it handles what you say. While it's
  busy, the mic key fills in with the accent color. A ring pulses out of it
  while it's listening, it breathes while processing, and while it's
  responding, the mic becomes bars that rise and fall like a voice meter.
- Without an assist satellite, the card just reads **Unmuted**.
- While it's muted, the mic is crossed out, the card takes a tint of the danger
  color and reads **Muted**, so a muted assistant stands out on the dashboard.
- The name is the device the switch is on, as Home Assistant shows it on the
  device's page, and the assist satellite is the one on that device. A switch
  that isn't on a device shows its own name, and needs `satellite_entity` to
  show the satellite's state.
- While the assist satellite is `unavailable`, the card reads **Unavailable**
  and the mic is greyed out. Tapping still mutes or unmutes.
- While the switch is `unavailable` or missing, the card does the same, also
  dims, and tapping it does nothing.
- Every tap asks the Home Assistant app for a light haptic.

## Examples

### Custom name

```yaml
type: custom:voice-mute-card
entity: switch.living_room_jabra_mute
name: Living Room
```

### Satellite on another device

```yaml
type: custom:voice-mute-card
entity: input_boolean.kitchen_mic_mute
name: Kitchen
satellite_entity: assist_satellite.kitchen
```
