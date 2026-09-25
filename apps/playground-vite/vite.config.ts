import { shadcnLabsDevtools } from "@shadcn-labs/devtools-vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [shadcnLabsDevtools(), react()],
});
