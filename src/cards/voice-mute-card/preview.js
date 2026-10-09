// A mock voice assistant's mute switch for the playground, on the device it
// belongs to, so the card shows the device's name.
export default {
  entities: {
    "switch.living_room_jabra_mute": {
      state: "off",
      options: ["on", "off", "unavailable"],
      attributes: { friendly_name: "Living Room Jabra Mute" },
    },
  },
  devices: {
    living_room_jabra: { name: "Living Room Jabra", entities: ["switch.living_room_jabra_mute"] },
  },
};
