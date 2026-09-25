import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

// Serve the ogimagecn plugin from source so the demo reflects edits without a
// rebuild; the toolbar itself is imported from ../src by main.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@shadcn-labs/devtools-plugin-ogimagecn": fileURLToPath(
        new URL("../../plugins/ogimagecn/src/index.ts", import.meta.url)
      ),
    },
  },
  // `pnpm demo -- --port N` forwards the `--` to Vite, which then ignores the
  // flags; pin the documented port here instead. IPv4 loopback so port probes
  // on 127.0.0.1 see it (Node resolves `localhost` to ::1 on macOS).
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
});
