# Date & Time

A clock that updates every second. Seconds and the date are optional, and it
can list the time in other time zones below.

It shows the time at your home, in the time zone set in Home Assistant
(**Settings → System → General**), even on a device set to another zone.

## Usage

```yaml
type: custom:datetime-card
```

## Options

| Option             | Type    | Default                   | Description                                                                 |
| ------------------ | ------- | ------------------------- | --------------------------------------------------------------------------- |
| `name`             | string  | none                      | Title above the time.                                                       |
| `has_seconds`      | boolean | `false`                   | Show seconds, half size, after the minutes.                                 |
| `has_date`         | boolean | `false`                   | Show the weekday, day and month below the time.                             |
| `hour12`           | boolean | `false`                   | Use a 12-hour clock. Otherwise the clock is 24-hour.                        |
| `locale`           | string  | Home Assistant's language | BCP 47 locale for formatting, e.g. `en-GB` or `de`.                         |
| `time_zone`        | string  | your home's time zone     | IANA time zone, e.g. `Europe/London` or `America/New_York`.                 |
| `other_time_zones` | list    | none                      | More clocks, listed below. See below. |

### Other time zone options

Each entry in `other_time_zones` is one row. Rows follow the main clock's
`hour12` and `locale`, but never show seconds.

| Option      | Type   | Default       | Description                            |
| ----------- | ------ | ------------- | -------------------------------------- |
| `time_zone` | string | **required**  | IANA time zone, e.g. `Asia/Tokyo`.     |
| `name`      | string | the time zone | Label to the left of the time.         |

## Examples

### Everything

```yaml
type: custom:datetime-card
name: Home
has_seconds: true
has_date: true
hour12: true
locale: en-GB
time_zone: Europe/London
other_time_zones:
  - name: New York
    time_zone: America/New_York
  - name: Tokyo
    time_zone: Asia/Tokyo
  - time_zone: Australia/Sydney
```

### Wall clock

```yaml
type: custom:datetime-card
has_seconds: true
has_date: true
```

### Another city

```yaml
type: custom:datetime-card
name: New York
time_zone: America/New_York
```

### World clock

```yaml
type: custom:datetime-card
has_date: true
other_time_zones:
  - name: New York
    time_zone: America/New_York
  - name: Tokyo
    time_zone: Asia/Tokyo
  - name: Sydney
    time_zone: Australia/Sydney
```
