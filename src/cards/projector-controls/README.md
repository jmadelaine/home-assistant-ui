# Projector Controls

A touch remote for an Android-based projector: arrow pad, select, home, back,
volume and power. Key presses go to a `remote` entity via `remote.send_command`
(for example from the Android TV Remote integration).

## Usage

```yaml
type: custom:projector-controls
```

## Options

| Option         | Type   | Default                  | Description                                                                                                                   |
| -------------- | ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `entity`       | string | `remote.projector`       | Remote entity that receives the key commands.                                                                                 |
| `on_entity`    | string | `button.projector_on`    | Button entity pressed by **Projector on**, e.g. one that broadcasts a Bluetooth wake signal.                                  |
| `power_entity` | string | `media_player.projector` | Media player that decides whether the projector counts as on. **Projector off** calls `media_player.turn_off` on this entity. |

## Behavior

- **Tap** sends the key: `HOME`, `BACK`, `VOLUME_UP`, `VOLUME_DOWN`, `DPAD_UP`,
  `DPAD_DOWN`, `DPAD_LEFT`, `DPAD_RIGHT` or `DPAD_CENTER`.
- **Hold select** for 0.5 s to send `DPAD_CENTER` with `hold_secs: 0.5` (a long press).
- A key only fires when your finger goes down and up on the same key, so sliding
  across the pad sends nothing.
- While `power_entity` is `off`, `standby`, `unavailable`, `unknown` or missing,
  the card shows **Projector on** and dims the other keys. Otherwise it shows
  **Projector off**.
- Every press asks the Home Assistant app for a light haptic.

## Examples

### Different entities

```yaml
type: custom:projector-controls
entity: remote.living_room_projector
on_entity: button.living_room_projector_wake
power_entity: media_player.living_room_projector
```
