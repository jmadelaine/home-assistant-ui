import { defineConfig } from "vite";

// `npm run dev` serves the playground (index.html + dev/).
// `npm run build` bundles every card into dist/home-assistant-ui.js for Home Assistant.
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "home-assistant-ui.js",
    },
  },
});
