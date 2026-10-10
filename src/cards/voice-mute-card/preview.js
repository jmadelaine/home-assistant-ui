// A mock voice assistant for the playground: its mute switch and assist
// satellite, on the device they belong to, so the card shows the device's
// name and finds the satellite.
export default {
  entities: {
    "switch.living_room_jabra_mute": {
      state: "off",
      options: ["on", "off", "unavailable"],
      attributes: { friendly_name: "Living Room Jabra Mute" },
    },
    "assist_satellite.living_room_jabra": {
      state: "idle",
      options: ["idle", "listening", "processing", "responding", "unavailable"],
      attributes: { friendly_name: "Living Room Jabra Assist satellite" },
    },
  },
  devices: {
    living_room_jabra: {
      name: "Living Room Jabra",
      entities: ["switch.living_room_jabra_mute", "assist_satellite.living_room_jabra"],
    },
  },
};
