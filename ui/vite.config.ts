import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({

    plugins: [

        react()

    ],

    server: {

        // Required for GitHub Codespaces port forwarding
        host: true,

        port: 5173,

        strictPort: true,

        // Browser calls /api/* → Vite forwards to the Sniper Express API
        proxy: {

            "/api": {

                target: "http://127.0.0.1:3000",

                changeOrigin: true,

                secure: false,

                rewrite: (path) =>

                    path.replace(/^\/api/, "")

            }

        }

    }

});
