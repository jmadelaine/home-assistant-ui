// A stand-in for the `hass` object Home Assistant hands to every card.
// Like the real frontend, every change produces a new object.

// Used when a card's preview.js doesn't handle a service itself.
const defaultServices = {
  turn_on: ({ entityIds, setState }) =>
    entityIds.forEach((id) => setState(id, "on")),
  turn_off: ({ entityIds, setState }) =>
    entityIds.forEach((id) => setState(id, "off")),
  toggle: ({ entityIds, setState, states }) =>
    entityIds.forEach((id) =>
      setState(id, states[id]?.state === "on" ? "off" : "on"),
    ),
};

// `preview` is a card's preview.js export:
//   entities: { "light.x": "on" | { state, attributes, options } }
//   services: { "domain.service": ({ data, entityIds, setState, states }) => {} }
//   api: (method, path, hass) => response, for hass.callApi (Home Assistant's REST API)
//   ws: (message, hass) => response, for hass.callWS (Home Assistant's websocket API)
//   devices: { "<device id>": { name, entities: ["switch.x"] } }, for hass.devices
//     and hass.entities (Home Assistant's device and entity registries)
// onUpdate(hass) runs after every state change; onCall(call) for every service
// call; onApi(request) for every callApi; onWs(message) for every callWS.
export function createMockHass(preview = {}, { onUpdate, onCall, onApi, onWs, darkMode = false } = {}) {
  const { entities = {}, services = {}, api, ws, devices = {} } = preview;
  const states = {};
  let hass;

  const write = (entityId, state, attributes) => {
    const now = new Date().toISOString();
    const prev = states[entityId];
    state = String(state);
    states[entityId] = {
      entity_id: entityId,
      state,
      attributes: attributes ?? prev?.attributes ?? {},
      last_changed: prev?.state === state ? prev.last_changed : now,
      last_updated: now,
      context: { id: Math.random().toString(36).slice(2), parent_id: null, user_id: null },
    };
  };

  const publish = () => {
    hass = build();
    onUpdate?.(hass);
  };

  const setState = (entityId, state, attributes) => {
    write(entityId, state, attributes);
    publish();
  };

  const callService = async (domain, service, data = {}, target = {}) => {
    onCall?.({ domain, service, data, target });
    const entityIds = [target.entity_id ?? data.entity_id ?? []].flat();
    const handler = services[`${domain}.${service}`] ?? defaultServices[service];
    handler?.({ domain, service, data, target, entityIds, setState, states });
  };

  const callApi = async (method, path) => {
    onApi?.({ method, path });
    const response = api?.(method, path, hass);
    if (response === undefined) throw new Error(`No mock for ${method} ${path} in preview.js api`);
    return response;
  };

  const callWS = async (message) => {
    onWs?.(message);
    const response = ws?.(message, hass);
    if (response === undefined) throw new Error(`No mock for ${message.type} in preview.js ws`);
    return response;
  };

  // Events never fire in the playground; subscribing just succeeds
  const connection = {
    subscribeEvents: async () => async () => {},
  };

  // The registries: each device, and the device each entity belongs to
  const deviceRegistry = {};
  const entityRegistry = {};
  for (const [id, { entities: ids = [], ...device }] of Object.entries(devices)) {
    deviceRegistry[id] = { id, name_by_user: null, ...device };
    for (const entityId of ids) entityRegistry[entityId] = { entity_id: entityId, device_id: id };
  }

  const build = () => ({
    states: { ...states },
    entities: entityRegistry,
    devices: deviceRegistry,
    callService,
    callApi,
    callWS,
    connection,
    themes: { darkMode, theme: "default", themes: {} },
    selectedTheme: null,
    language: "en",
    locale: { language: "en", number_format: "language", time_format: "language" },
    // Home location: Oslo, where Met.no is
    config: {
      latitude: 59.9139,
      longitude: 10.7522,
      elevation: 23,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      unit_system: { length: "km", mass: "kg", temperature: "°C", volume: "L" },
    },
    user: { id: "dev", name: "Developer", is_admin: true },
  });

  for (const [id, def] of Object.entries(entities)) {
    if (typeof def === "object") write(id, def.state, def.attributes);
    else write(id, def);
  }
  hass = build();

  return {
    get hass() {
      return hass;
    },
    setState,
    setDarkMode(value) {
      darkMode = value;
      publish();
    },
  };
}
