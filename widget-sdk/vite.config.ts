import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    target: "es2018",
    minify: "esbuild",
    sourcemap: true,
    outDir: path.resolve(__dirname, "../public"),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "VortexSuporte",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
