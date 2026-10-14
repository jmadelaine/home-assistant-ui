// A mock dimmable color light for the playground.

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
        setState(id, "on", attrs);
      }
    },
  },
};
