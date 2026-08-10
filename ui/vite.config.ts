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

        // Allow Codespaces forwarded hostnames
        allowedHosts: true,

        // Browser calls /api/* → Vite forwards to the Sniper Express API
        proxy: {

            "/api": {

                target: "http://127.0.0.1:3000",

                changeOrigin: true,

                secure: false,

                // Keep long scan/swing requests alive
                timeout: 300_000,

                proxyTimeout: 300_000,

                rewrite: (path) =>

                    path.replace(/^\/api/, ""),

                configure: (proxy) => {

                    proxy.on("error", (err, _req, res) => {

                        console.error("[vite proxy]", err.message);

                        if (res && !res.headersSent) {

                            res.writeHead(502, { "Content-Type": "application/json" });

                            res.end(JSON.stringify({

                                success: false,

                                error: `Proxy to API failed: ${err.message}. Is npx tsx src/server/Server.ts running?`

                            }));

                        }

                    });

                }

            }

        }

    }

});
