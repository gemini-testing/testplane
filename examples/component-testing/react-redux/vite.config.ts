import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [
        react(),
        {
            name: "testplane-debug-compat",
            // The locked Testplane release needs debug pre-bundling with Vite 6.
            // A plugin hook appends to, rather than replaces, Testplane's include list.
            config: () => ({ optimizeDeps: { include: ["debug"] } }),
        },
    ]
});
