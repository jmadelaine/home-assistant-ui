# Pressure

Hourly air pressure from [Open-Meteo](https://open-meteo.com/) for a location:
the last 40 hours and the next 72. It shows the pressure now and how much it
has changed in 24 hours. It also marks the falls that tend to bring on
migraines, and says when the next one is coming. It can mark sharp rises too.

The card fetches the pressure itself, so no entity is needed. Open-Meteo is
free and needs no API key.

## Usage

```yaml
type: custom:pressure-card
```

## Options

| Option           | Type           | Default                        | Description                                                                 |
| ---------------- | -------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `latitude`       | number         | your home's                    | Latitude of the location.                                                   |
| `longitude`      | number         | your home's                    | Longitude of the location.                                                  |
| `past_hours`     | number         | `40`                           | Hours of the past the chart shows, up to 2160.                              |
| `forecast_hours` | number         | `72`                           | Hours of forecast the chart shows, up to 383.                               |
| `migraine_drop`  | number / false | `5`                            | Fall in hPa over 24 hours that makes a migraine likely. `false` stops marking falls. |
| `migraine_rise`  | number / false | `false`                        | Rise in hPa over 24 hours that makes a migraine likely, if yours follow rises. See [Migraine levels](#migraine-levels). |
| `pressure_unit`  | string         | `hPa`, or `inHg` if HA uses °F | `hPa`, `mbar`, `inHg` or `mmHg`.                                            |

Without `latitude` and `longitude`, the card uses the home location set in
Home Assistant (**Settings → System → General**). With both `migraine_drop`
and `migraine_rise` set to `false`, the card hides the migraine risk,
thresholds and headline. Both are always in hPa, whatever `pressure_unit` is. The unit value is not case-sensitive.

## Behavior

- The pressure is at sea level, the figure weather forecasts and barometers
  give, so it's the same wherever your home is and however high.
- **Migraine likely** means the pressure is at least `migraine_drop` hPa lower
  than 24 hours before, or, with `migraine_rise` set, at least that many hPa
  higher. The line turns red for those hours.
- The dashed red line is the pressure 24 hours before, less `migraine_drop`.
  Wherever the pressure line drops below it, a migraine is likely. With
  `migraine_rise` set, a second one sits above it, at the pressure 24 hours
  before plus `migraine_rise`.
- The headline looks ahead over the forecast, to whichever sharp fall or rise
  comes first:
  - "No sharp falls in the next 72 hours" ("falls or rises" with `migraine_rise`)
  - "Falling fast from Wed 15:00 · −7.2 hPa in 24 h" (the steepest fall in that spell)
  - "Falling fast until 21:00" (it's falling fast now)
  - "Rising fast from Thu 03:00 · +6.1 hPa in 24 h" (with `migraine_rise`)
- Under the reading, **Falling** or **Rising** means the pressure moved at
  least 1 hPa in 24 hours, otherwise **Steady**.
- The past is dimmed. Open-Meteo's past hours are its weather model's, not a
  barometer's, but they're close.
- The chart covers at least 16 hPa, so a calm day looks nearly flat.
- Times show every 6 hours under the chart, with each day's name below them
  and a line at each midnight. On a narrow card the times are shortened, e.g.
  "06" for 06:00.
- Hover or drag across the chart to read any hour: its pressure, its 24-hour
  change and whether a migraine is likely.
- The card fetches again just after each hour, when Open-Meteo moves on an
  hour. If a fetch fails, it tries again in 10 minutes.

## Migraine levels

Research on pressure and migraines is thin. A few small studies, mostly from
Japan, link migraines to pressure **falling**, more than to pressure being low:

- Over a year of diaries from 28 patients, migraines became more common when
  pressure fell more than 5 hPa from one day to the next. How high or low the
  pressure was on average made no difference.
  ([Kimoto et al. 2011](https://pubmed.ncbi.nlm.nih.gov/21921370/))
- In 34 patients, most attacks started after pressure fell 6–10 hPa below the
  standard 1013 hPa.
  ([Okuma et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4684554/))

So the card's default is a 5 hPa fall in 24 hours. People differ. If your
migraines follow smaller or only bigger falls, change `migraine_drop`.

Rises are off by default because the research doesn't back them. In the
Kimoto diaries, migraines became **less** common when pressure rose more than
5 hPa ([Kimoto et al. 2011](https://pubmed.ncbi.nlm.nih.gov/21921370/)). A
[systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12617017/) of 14
studies found the results mixed, with the links mostly to falls or rapid
swings. Still, some people find their migraines follow a rise. If yours do, set
`migraine_rise`, e.g. to `5`, and the card marks sharp rises the same way.

## Colors

The line and the risk use your theme's error color (`error-color`) for
likely migraine weather.

## Examples

### Another place, in inches of mercury

```yaml
type: custom:pressure-card
latitude: 40.015
longitude: -105.2705
pressure_unit: inHg
```

### A week back, five days ahead

```yaml
type: custom:pressure-card
past_hours: 168
forecast_hours: 120
```

### More sensitive to falls

```yaml
type: custom:pressure-card
migraine_drop: 3
```

### Rises too

```yaml
type: custom:pressure-card
migraine_rise: 5
```

### Just the pressure

```yaml
type: custom:pressure-card
migraine_drop: false
```
