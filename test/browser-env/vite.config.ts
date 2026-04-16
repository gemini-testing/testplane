import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    plugins: [],
    server: {
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
    },
    define: {
        global: "globalThis",
        exports: "{}",
        module: "{ exports: {} }",
    },
    optimizeDeps: {
        include: [
            "lib/**/*.js",
            "expect",
            "aria-query",
            "css-shorthand-properties",
            "css-value",
            "grapheme-splitter",
            "lodash.clonedeep",
            "lodash.zip",
            "minimatch",
            "rgb2hex",
            "ws",
            "debug",
        ],
    },
    resolve: {
        alias: {
            "@isomorphic": path.resolve(__dirname, "../../src/browser/isomorphic/index.ts"),
            "@": path.resolve(__dirname, "../../lib"),
            lib: path.resolve(__dirname, "../../lib"),
        },
    },
    css: {
        modules: {
            localsConvention: "camelCase",
        },
    },
});
