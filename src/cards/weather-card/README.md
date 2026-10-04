# Weather

The forecast from [Met.no](https://api.met.no/) (the Norwegian Meteorological
Institute) for a location. It shows the conditions now and one line saying when
it will rain next. It can also show wind, pressure and humidity, an hourly
forecast, an hourly rain chart, and a strip of the days ahead.

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
| `has_details`        | boolean | `false`                      | Show wind speed and direction, pressure and humidity.                       |
| `has_hourly_forecast` | boolean | `false`                     | Show each hour's temperature and weather.                                   |
| `has_rain_chart`     | boolean | `false`                      | Show a bar for each hour's rain.                                            |
| `has_daily_forecast` | boolean | `false`                      | Show a tile for each day ahead.                                             |
| `hours`              | number  | `24`                         | How many hours ahead the headline and hourly panel look.                    |
| `days`               | number  | `5`                          | How many days the strip shows, starting today.                              |
| `temperature_unit`   | string  | `C`, or `F` if HA uses °F    | `C` or `F`.                                                                 |
| `precipitation_unit` | string  | `mm`, or `in` if HA uses °F  | `mm` or `in`.                                                               |
| `pressure_unit`      | string  | `hPa`, or `inHg` if HA uses °F | `hPa`, `mbar`, `inHg` or `mmHg`.                                          |
| `wind_speed_unit`    | string  | `kmph`, or `mph` if HA uses °F | `kmph`, `mph`, `ftps` (ft/s), `kn` (knots) or `mps` (m/s).                |

Without `latitude` and `longitude`, the card uses the home location set in
Home Assistant (**Settings → System → General**). Unit values are not case-sensitive.

## Behavior

- The headline reads the hourly forecast:
  - "Dry for the next 24 hours"
  - "Rain from 15:00 · 3 mm"
  - "Rain until 17:00 · 2.5 mm" (it's raining now)
  - "Snow …" or "Sleet …" when the forecast says so
- Met.no has no windy forecast. The card shows **Windy** when it's dry and the
  wind is a strong breeze or more: 10.8 m/s, 39 km/h, 24 mph.
- The hourly forecast and rain chart share one panel and one row of times, so
  each temperature and icon sits above that hour's rain. Turn on either or both.
- When the card is too narrow for every hour's temperature and icon, it shows
  every second or third hour. The rain bars always show every hour.
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

### Everything

```yaml
type: custom:weather-card
has_details: true
has_hourly_forecast: true
has_rain_chart: true
has_daily_forecast: true
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
has_details: true
```

### Garden thermometer

```yaml
type: custom:weather-card
name: Garden
temperature_entity: sensor.outdoor_temperature
has_rain_chart: true
```
