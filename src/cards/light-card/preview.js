// A mock dimmable color light for the playground.
export default {
  entities: {
    "light.bedroom": {
      state: "on",
      options: ["on", "off", "unavailable"],
      attributes: {
        friendly_name: "Bedroom Light",
        supported_color_modes: ["color_temp", "rgbww"],
        color_mode: "color_temp",
        color_temp_kelvin: 3000,
        rgb_color: [255, 177, 110],
        brightness: 153,
      },
    },
  },
  services: {
    "light.turn_on": ({ data, entityIds, setState, states }) => {
      for (const id of entityIds) {
        const attrs = { ...states[id]?.attributes };
        if (data.brightness_pct) attrs.brightness = Math.round((data.brightness_pct / 100) * 255);
        setState(id, "on", attrs);
      }
    },
  },
};
