import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["es"],
      entry: "electron/main.ts",
      fileName: "main",
    },
    rollupOptions: {
      external: [
        "better-sqlite3",
        'bits-ui'
        // "drizzle-orm",
        // "./electron/backend/db",
        // "./electron/backend/schema",
        // "./electron/backend/users",
      ],
    },
  },
});
