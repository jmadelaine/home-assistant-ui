# Weather

The forecast from [Met.no](https://api.met.no/) (the Norwegian Meteorological
Institute) for a location. It shows the conditions now, today's wind, pressure
and humidity, one line saying when it will rain today, and a strip of the days
ahead.

Tap a day and the whole card shows that day: its weather, high and low, wind,
pressure, humidity and rain, and each hour's temperature, weather and rain. Tap
anywhere else on the card to show today. Tap anywhere on the card to go back.

The card fetches the forecast itself, so no weather entity is needed.

## Usage

```yaml
type: custom:weather-card
```

## Options

| Option               | Type    | Default                      | Description                                                                 |
| -------------------- | ------- | ---------------------------- | --------------------------------------------------------------------------- |
| `latitude`           | number  | your home's                  | Latitude of the forecast location.                                          |
| `longitude`          | number  | your home's                  | Longitude of the forecast location.                                         |
| `elevation`          | number  | your home's                  | Height above sea level in meters. It makes the temperature more accurate.   |
| `name`               | string  | none                         | Title under the condition.                                                  |
| `temperature_entity` | string  | none                         | Sensor whose temperature replaces the forecast's, e.g. your own thermometer. |
| `days`               | number  | `5`                          | How many days the strip shows, starting today.                              |
| `temperature_unit`   | string  | `C`, or `F` if HA uses °F    | `C` or `F`.                                                                 |
| `precipitation_unit` | string  | `mm`, or `in` if HA uses °F  | `mm` or `in`.                                                               |
| `pressure_unit`      | string  | `hPa`, or `inHg` if HA uses °F | `hPa`, `mbar`, `inHg` or `mmHg`.                                          |
| `wind_speed_unit`    | string  | `kmph`, or `mph` if HA uses °F | `kmph`, `mph`, `ftps` (ft/s), `kn` (knots) or `mps` (m/s).                |

Without `latitude` and `longitude`, the card uses the home location set in
Home Assistant (**Settings → System → General**). Unit values are not case-sensitive.

## Behavior

- A day covers midnight to midnight. Today covers this hour to midnight, and
  its top shows the weather now. Other days show their high at the top.
- The headline reads the day's forecast:
  - "Dry all day", or "Dry for the rest of the day" today
  - "Rain from 15:00 · 3 mm"
  - "Rain until 17:00 · 2.5 mm" (it rains from the start of the day, or now)
  - "Snow …" or "Sleet …" when the forecast says so
- The day's wind is its strongest, with the direction it blows from then. Its
  pressure and humidity are averages.
- Met.no forecasts hourly for about two days, then every 6 hours. Days further
  ahead show 6-hourly columns, and their rain bars are scaled per hour so they
  compare with hourly days.
- Met.no has no windy forecast. The card shows **Windy** when it's dry and the
  wind is a strong breeze or more: 10.8 m/s, 39 km/h, 24 mph.
- The hourly forecast and rain chart share one panel and one row of times, so
  each temperature and icon sits above that hour's rain.
- The temperature line's height covers at least 8°C (14°F), so a day that
  barely changes looks nearly flat. The line never curves past the forecast values.
- When the card is too narrow for every hour's temperature and icon, it labels
  every second or third hour. The line and the rain bars always cover every
  hour, and hovering an hour shows its temperature.
- The rain chart's scale is at least 2.5 mm per hour, so drizzle doesn't look like a downpour.
- Today's high and low cover the rest of today.
- The card fetches the forecast again when Met.no says it has expired, which is
  usually every 30 minutes. If a fetch fails, it tries again in 10 minutes.
- Each browser showing the card fetches its own forecast. The browser caches it
  until it expires, as Met.no's terms ask.

## Colors

Icons, rain bars and rain amounts are colored by the weather, using the
`--weather-*` colors in the shared theme. To change one, set its variable in
your Home Assistant theme:

| Theme variable          | Weather                         | Default                  |
| ----------------------- | ------------------------------- | ------------------------ |
| `weather-sun-color`     | sunny, partly cloudy            | `#f2a516`                |
| `weather-night-color`   | clear or partly cloudy at night | `#7f8cc9`                |
| `weather-cloud-color`   | cloudy, fog                     | `secondary-text-color`   |
| `weather-rain-color`    | rain, and all rain amounts      | `#3d9be9`                |
| `weather-pouring-color` | heavy rain                      | `#2c6fd1`                |
| `weather-storm-color`   | thunderstorms                   | `#8e5bd8`                |
| `weather-snow-color`    | snow, sleet                     | `#2e9cbf`                |
| `weather-wind-color`    | windy                           | `#1e9488`                |

## Examples

### A week ahead

```yaml
type: custom:weather-card
days: 7
```

### Another place, in imperial units

```yaml
type: custom:weather-card
name: Boulder
latitude: 40.015
longitude: -105.2705
elevation: 1655
temperature_unit: F
precipitation_unit: in
pressure_unit: inHg
wind_speed_unit: mph
```

### Garden thermometer

```yaml
type: custom:weather-card
name: Garden
temperature_entity: sensor.outdoor_temperature
```
