// Mock entities and service behavior for the dev playground only.
export default {
  entities: {
    "media_player.projector": {
      state: "off",
      options: ["on", "off", "standby", "unavailable"],
    },
    "remote.projector": { state: "on" },
    "button.projector_on": { state: "unknown" },
  },
  services: {
    // The wake broadcast takes a moment before the projector reports back
    "button.press": ({ entityIds, setState }) => {
      if (entityIds.includes("button.projector_on")) {
        setTimeout(() => setState("media_player.projector", "on"), 800);
      }
    },
  },
};
