import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("@tanstack")) {
              return "react-query";
            }
            if (id.includes("recharts")) {
              return "recharts";
            }
            if (id.includes("@radix-ui")) {
              // Radix UI depends on React DOM internals. Forcing those modules
              // into a dedicated manual chunk can reorder the evaluation of
              // React's runtime and surface "Cannot access '$t' before
              // initialization" errors in production. Let Vite manage the
              // optimal split for these files instead.
              return undefined;
            }
            if (id.includes("react-router")) {
              return "react-router";
            }
            if (id.includes("lucide-react")) {
              return "icons";
            }
          }
          return undefined;
        },
      },
    },
  },
}));
