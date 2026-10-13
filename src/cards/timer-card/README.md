# Timer

Countdown timers, e.g. for cooking. Set a length with −5, −1, +1, +5, +10 and
+30, tap **Start**, and run as many as you like at once. Each shows the time
left, its length, when it ends (e.g. 5:00 · ends 14:44) and a bar that fills as
it runs out. You can pause one, take a minute off or add one, or pause and
delete it. When one finishes, it turns amber and the device showing the card
chimes until you dismiss it.

The timers live in the browser, so no Home Assistant helpers are needed.

## Usage

```yaml
type: custom:timer-card
```

## Options

| Option | Type   | Default | Description       |
| ------ | ------ | ------- | ----------------- |
| `name` | string | none    | Title at the top. |

## Behavior

- **−5**, **−1**, **+1** and **+5** around the length, and **+10** and **+30**
  beside **Start**, change the next timer's length by that many minutes, from
  0 up to 24 hours. **Clear** sets it back to 0. **Start**
  starts the timer, then the length goes back to 0, ready for the next one.
- A running timer can't be deleted, so a stray tap can't lose it. Pause it
  first: **▶** takes **⏸**'s place, and a red **🗑** appears at the other end
  of the row, away from your finger. A finished timer has a red **🗑** too,
  to clear it.
- On a running or paused timer, **−1** and **+1** take a minute off or add
  one. **−1** is off in a timer's last minute, so a tap can't end it early.
  **+1** on a finished timer starts it again with one minute, for food that
  needs a little longer.
- Timers are listed finished first, then running, then paused, each soonest first.
- Every timer ends on a whole second, and the card redraws as each second of
  the clock begins, so all the timers (and a Date & Time card's seconds) change
  together. A timer can run up to a second short as a result.
- Timers are kept in the browser's storage, so they carry on through a reload
  or after the dashboard is closed and opened again. Each device has its own:
  a timer started on the kitchen tablet doesn't show on your phone.
- Every Timer card on a device shows the same timers, and so does every tab.
- A finished timer takes your theme's warning color (`warning-color`, amber by default).
- Browsers slow down pages in background tabs, so a timer in a hidden tab may
  chime a little late. A dashboard on screen is on time.

## Sound

The chime plays on the device showing the card: five quick, warm dings climbing
a happy chord and bouncing back a step, like a friendly doorbell, each with a
light bell ringing over it, with a soft echo in a small room, then a pause,
repeating every 2 seconds until you dismiss the timer, for up to 10 minutes.
The bell beside **Done** keeps swinging until you dismiss it. In the Home
Assistant app the device also vibrates.

Browsers only let a page make sound after someone has interacted with it. Any
tap anywhere in Home Assistant counts, including the one that opened the
dashboard, so the sound is on without tapping the card. The exception is a
page that has just loaded and hasn't been touched, e.g. a wall tablet after a
restart. Then, if timers are running, the card shows **Tap anywhere to turn the
sound on** at the bottom.

To have sound even then, allow autoplay for Home Assistant in the browser:

- **Kiosk browsers and apps** usually have an autoplay setting. Turn on
  autoplay for audio.
- **Firefox:** click the icon left of the address, then set **Autoplay** to
  **Allow Audio and Video**.
- **Safari:** **Safari → Settings for this website → Auto-Play → Allow All Auto-Play**.
- **Chrome** as a kiosk: start it with `--autoplay-policy=no-user-gesture-required`.

## Examples

### Kitchen

```yaml
type: custom:timer-card
name: Kitchen
```
