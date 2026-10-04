// Mock System Monitor sensors for the playground, and their history
// (GET history/period/<start>?filter_entity_id=&end_time=). The history ends at
// each sensor's current mock value, so edit one in the Mock entities panel to
// add a live reading, or edit the YAML to reload the history around it.

const SECOND = 1e3;

const CPU = "sensor.system_monitor_processor_use";
const MEMORY = "sensor.system_monitor_memory_usage";
const DISK = "sensor.system_monitor_disk_usage";

// Repeatable noise in 0..1, so the history doesn't jump on every render
const noise = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// Percent used at `p` (0 = the start of the window, 1 = now), ending at `current`
function reading(entity, p, i, current) {
  if (entity === CPU) {
    // Mostly idle, with a busy spell partway through
    const busy = p > 0.38 && p < 0.46 ? 70 + noise(i) * 22 : 0;
    return Math.max(busy, 2 + noise(i) * 9, p > 0.98 ? current : 0);
  }
  if (entity === MEMORY) {
    // A climb to about 75% later on, otherwise near the current value
    const climb = Math.max(0, 1 - Math.abs(p - 0.7) / 0.1) * (75 - current);
    return current + climb + (noise(i) - 0.5) * 2;
  }
  // Disk fills slowly
  return Math.max(0, current - (1 - p) * 0.4);
}

export default {
  entities: {
    [CPU]: { state: "2", attributes: { unit_of_measurement: "%", friendly_name: "Processor use" } },
    [MEMORY]: { state: "40", attributes: { unit_of_measurement: "%", friendly_name: "Memory usage" } },
    [DISK]: { state: "5.1", attributes: { unit_of_measurement: "%", friendly_name: "Disk usage" } },
  },
  api(method, path, hass) {
    const url = new URL(path, "http://ha/api/");
    const start = url.pathname.match(/history\/period\/(.+)$/)?.[1];
    if (method !== "GET" || !start) return undefined;
    const from = Date.parse(decodeURIComponent(start));
    const to = Date.parse(url.searchParams.get("end_time")) || Date.now();
    const ids = (url.searchParams.get("filter_entity_id") ?? "").split(",");

    // A reading every 10 seconds; like Home Assistant, only the first names its entity
    return ids.map((entity) => {
      const current = parseFloat(hass.states[entity]?.state) || 0;
      const list = [];
      for (let t = from, i = 0; t <= to; t += 10 * SECOND, i++) {
        const v = reading(entity, (t - from) / (to - from), i, current);
        list.push({ state: v.toFixed(1), last_changed: new Date(t).toISOString() });
      }
      if (list.length) list[0].entity_id = entity;
      return list;
    });
  },
};
