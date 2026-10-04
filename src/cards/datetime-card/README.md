# Date & Time

A clock that updates every second. Seconds and the date are optional.

It shows the time at your home, in the time zone set in Home Assistant
(**Settings → System → General**), even on a device set to another zone.

## Usage

```yaml
type: custom:datetime-card
```

## Options

| Option         | Type    | Default               | Description                                                                         |
| -------------- | ------- | --------------------- | ----------------------------------------------------------------------------------- |
| `name`         | string  | none                  | Title above the time.                                                               |
| `size`         | string  | `small`               | `small` or `large`.                                                                 |
| `has_seconds`  | boolean | `false`               | Show seconds, half size, after the minutes.                                         |
| `has_date`     | boolean | `false`               | Show the weekday, day and month below the time.                                     |
| `hour12`       | boolean | `false`               | Use a 12-hour clock. Otherwise the clock is 24-hour.                                |
| `locale`       | string  | Home Assistant's language | BCP 47 locale for formatting, e.g. `en-GB` or `de`.                             |
| `time_zone`    | string  | your home's time zone | IANA time zone, e.g. `Europe/London` or `America/New_York`.                         |

## Examples

### Large wall clock

```yaml
type: custom:datetime-card
size: large
has_seconds: true
has_date: true
```

### Another city

```yaml
type: custom:datetime-card
name: New York
time_zone: America/New_York
```
