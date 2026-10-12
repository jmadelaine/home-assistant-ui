// Mock Open-Meteo responses for the playground. Pick a scenario in the Mock
// entities panel; "live" fetches the real pressure for the home location.

const HOUR = 3600e3;

// [hours from now, hPa] the pressure eases between. A small twice-daily tide
// rides on top, as it does in real air pressure.
const SCENARIOS = {
  "front ahead": [[-90, 1019], [8, 1018], [26, 1003], [44, 1011], [400, 1014]],
  "falling now": [[-90, 1017], [-20, 1016], [6, 1005], [30, 1012], [400, 1015]],
  "fell yesterday": [[-90, 1018], [-34, 1017], [-12, 1006], [10, 1013], [400, 1016]],
  "steady high": [[-90, 1026], [400, 1026]],
  "steady low": [[-90, 1004], [400, 1004]],
};

// Eases from one keyframe to the next, like weather systems coming and going
function pressureAt(keyframes, h) {
  const next = keyframes.findIndex(([at]) => at > h);
  const [h0, p0] = keyframes[Math.max(0, next - 1)];
  const [h1, p1] = keyframes[next === -1 ? keyframes.length - 1 : next];
  const f = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  return p0 + (p1 - p0) * (f * f * (3 - 2 * f));
}

function openMeteoResponse(url, name) {
  const params = new URL(url).searchParams;
  const past = Number(params.get("past_hours")) || 0;
  const ahead = Number(params.get("forecast_hours")) || 1;
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const time = [];
  const pressure = [];
  for (let h = -past; h < ahead; h++) {
    const t = start.getTime() + h * HOUR;
    const tide = 0.6 * Math.cos(((new Date(t).getHours() - 10) / 12) * 2 * Math.PI);
    time.push(t / 1000);
    pressure.push(Math.round((pressureAt(SCENARIOS[name], h) + tide) * 10) / 10);
  }
  return { hourly_units: { time: "unixtime", pressure_msl: "hPa" }, hourly: { time, pressure_msl: pressure } };
}

export default {
  entities: {
    "input_select.pressure_scenario": {
      state: "front ahead",
      options: ["live", ...Object.keys(SCENARIOS)],
    },
  },
  fetch(url, hass) {
    const scenario = hass.states["input_select.pressure_scenario"].state;
    if (!url.startsWith("https://api.open-meteo.com/") || scenario === "live") return undefined;
    return openMeteoResponse(url, scenario);
  },
};
