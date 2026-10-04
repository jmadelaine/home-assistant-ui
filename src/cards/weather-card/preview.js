// Mock Met.no responses for the playground. Pick a scenario in the Mock
// entities panel; "live" fetches the real forecast for the home location.
// The scenario sets the next 52 hours; the days after follow DAYS.

const HOUR = 3600e3;

const rainSymbol = (mm) => (mm > 4 ? "heavyrain" : mm > 1 ? "rain" : "lightrain");

// One per kind of weather the card can show.
//   dry:  Met.no symbol for the dry hours
//   rain: mm for each coming hour; wet: symbol for a wet hour
//   wind: wind speed in m/s
const SCENARIOS = {
  sun: { dry: "clearsky_day" },
  moon: { dry: "clearsky_night" },
  "partly cloudy": { dry: "partlycloudy_day" },
  "partly cloudy night": { dry: "partlycloudy_night" },
  cloud: { dry: "cloudy" },
  fog: { dry: "fog" },
  wind: { dry: "partlycloudy_day", wind: 13.5 },
  "rain later": { dry: "cloudy", rain: [0, 0, 0, 0.2, 0.9, 2.1, 1.4, 0.3] },
  rain: { dry: "cloudy", rain: [1.2, 0.8, 0.6, 0.3] },
  pouring: { dry: "cloudy", rain: [6, 8, 5, 4, 3, 3, 2, 2, 1.5, 1, 1, 0.8, 0.5] },
  storm: {
    dry: "cloudy",
    rain: [3, 5.5, 4, 2, 0.6],
    wet: (mm) => (mm > 4 ? "heavyrainandthunder" : "rainandthunder"),
    wind: 9,
  },
  snow: { dry: "cloudy", rain: [0.4, 0.6, 0.5, 0.2], wet: (mm) => (mm > 0.4 ? "snow" : "lightsnow") },
  sleet: { dry: "cloudy", rain: [0.8, 1.1, 0.5], wet: (mm) => (mm > 1 ? "sleet" : "lightsleet") },
};

// [symbol, high, low, rain in mm] from today onwards
const DAYS = [
  ["partlycloudy", 17, 9, 0],
  ["rain", 14, 8, 6.2],
  ["cloudy", 15, 9, 0.4],
  ["clearsky", 19, 10, 0],
  ["clearsky", 21, 11, 0],
  ["fair", 18, 10, 0],
  ["lightrain", 13, 8, 3.1],
  ["cloudy", 14, 8, 0],
  ["partlycloudy", 16, 9, 0],
  ["fair", 17, 9, 0],
];

const dayIndex = (time) => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Math.min(DAYS.length - 1, Math.floor((time - midnight) / (24 * HOUR)));
};

// Peaks mid-afternoon, lowest before dawn
const temperature = (time) => {
  const [, high, low] = DAYS[dayIndex(time)];
  return (high + low) / 2 + ((high - low) / 2) * Math.cos(((time.getHours() - 15) / 24) * 2 * Math.PI);
};

const period = (time) => (time.getHours() >= 7 && time.getHours() < 20 ? "_day" : "_night");

function instant(time, wet, scenario) {
  return {
    details: {
      air_temperature: Math.round(temperature(time) * 10) / 10,
      air_pressure_at_sea_level: wet ? 1004.2 : 1018.6,
      relative_humidity: scenario.dry === "fog" ? 99.2 : wet ? 93.1 : 71.4,
      wind_speed: scenario.wind ?? (wet ? 7.4 : 3.2),
      wind_from_direction: 225,
    },
  };
}

function metResponse(name) {
  const scenario = SCENARIOS[name];
  const { rain = [], wet = rainSymbol } = scenario;
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const timeseries = [];

  // Hourly for the first 52 hours, like Met.no
  for (let i = 0; i < 52; i++) {
    const time = new Date(start.getTime() + i * HOUR);
    const mm = rain[i] ?? 0;
    timeseries.push({
      time: time.toISOString(),
      data: {
        instant: instant(time, mm > 0, scenario),
        next_1_hours: {
          summary: { symbol_code: mm > 0 ? wet(mm) : scenario.dry },
          details: { precipitation_amount: mm },
        },
      },
    });
  }

  // Then every 6 hours, on 00/06/12/18 UTC
  let t = Math.ceil((start.getTime() + 52 * HOUR) / (6 * HOUR)) * 6 * HOUR;
  for (; dayIndex(new Date(t)) < DAYS.length - 1; t += 6 * HOUR) {
    const time = new Date(t);
    const [symbol, , , mm] = DAYS[dayIndex(time)];
    const temps = [0, 3, 6].map((h) => temperature(new Date(t + h * HOUR)));
    timeseries.push({
      time: time.toISOString(),
      data: {
        instant: instant(time, mm > 0, {}),
        next_6_hours: {
          summary: { symbol_code: ["rain", "lightrain", "cloudy"].includes(symbol) ? symbol : symbol + period(time) },
          details: {
            precipitation_amount: mm / 4,
            air_temperature_max: Math.max(...temps),
            air_temperature_min: Math.min(...temps),
          },
        },
      },
    });
  }

  return { type: "Feature", properties: { timeseries } };
}

export default {
  entities: {
    "input_select.weather_scenario": {
      state: "rain later",
      options: ["live", ...Object.keys(SCENARIOS)],
    },
    "sensor.outdoor_temperature": {
      state: "11.8",
      attributes: { unit_of_measurement: "°C", device_class: "temperature" },
    },
  },
  fetch(url, hass) {
    const scenario = hass.states["input_select.weather_scenario"].state;
    if (!url.startsWith("https://api.met.no/") || scenario === "live") return undefined;
    return metResponse(scenario);
  },
};
