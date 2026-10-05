// A mock dimmable color light for the playground, with four favorite colors.
const FAVORITES = [
  { color_temp_kelvin: 2700 },
  { rgb_color: [127, 172, 255] },
  { rgb_color: [215, 150, 255] },
  { rgb_color: [255, 110, 84] },
];

// Roughly how a color temperature looks, from candle orange to daylight white
function kelvinToRgb(kelvin) {
  const t = Math.min(1, Math.max(0, (kelvin - 2000) / 4500));
  return [255, Math.round(137 + t * 112), Math.round(14 + t * 239)];
}

export default {
  entities: {
    "light.bedroom": {
      state: "off",
      options: ["on", "off", "unavailable"],
      attributes: {
        friendly_name: "Bedroom Light",
        supported_color_modes: ["color_temp", "rgbww"],
        color_mode: "color_temp",
        color_temp_kelvin: 2700,
        rgb_color: kelvinToRgb(2700),
        brightness: 153,
      },
    },
  },
  services: {
    "light.turn_on": ({ data, entityIds, setState, states }) => {
      for (const id of entityIds) {
        const attrs = { ...states[id]?.attributes };
        if (data.brightness_pct) attrs.brightness = Math.round((data.brightness_pct / 100) * 255);
        if (data.color_temp_kelvin) {
          Object.assign(attrs, {
            color_mode: "color_temp",
            color_temp_kelvin: data.color_temp_kelvin,
            rgb_color: kelvinToRgb(data.color_temp_kelvin),
          });
        }
        if (data.rgb_color) {
          Object.assign(attrs, { color_mode: "rgbww", color_temp_kelvin: null, rgb_color: data.rgb_color });
        }
        setState(id, "on", attrs);
      }
    },
  },
  // The entity registry, where Home Assistant keeps a light's favorite colors
  ws({ type, entity_id }) {
    if (type === "config/entity_registry/get" && entity_id === "light.bedroom") {
      return { entity_id, options: { light: { favorite_colors: FAVORITES } } };
    }
    return undefined;
  },
};
