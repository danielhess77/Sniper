/**
 * Sniper Server v2.4
 *
 * Express API: 0DTE scan + RVOL + Swing + Watchlist editor.
 */

import express from "express";
import cors from "cors";

import { BDKClient } from "../core/BDKClient.js";
import { Scanner } from "../core/Scanner.js";
import { SwingScanner } from "../core/SwingScanner.js";
import { RvolEngine } from "../engines/RvolEngine.js";

import { watchlistStore } from "../config/WatchlistStore.js";

import { TrendContinuation } from "../playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "../playbooks/OpeningRangeBreakout.js";
import { VWAPReclaim } from "../playbooks/VWAPReclaim.js";
import { FirstPullback } from "../playbooks/FirstPullback.js";

const app = express();

app.use(cors());

app.use(express.json({ limit: "32kb" }));

// Load watchlist from data/watchlist.json (or seed defaults)
watchlistStore.load();

const bdk = new BDKClient();

const scanner = new Scanner(

    bdk,

    [

        new TrendContinuation(),

        new OpeningRangeBreakout(),

        new VWAPReclaim(),

        new FirstPullback()

    ]

);

const swingScanner = new SwingScanner(bdk);

const rvolEngine = new RvolEngine(bdk);

//--------------------------------------------------
// Health Check
//--------------------------------------------------

app.get(

    "/health",

    (_, res) => {

        res.json({

            success: true,

            status: "ok",

            timestamp: new Date().toISOString(),

            watchlist: watchlistStore.count()

        });

    }

);

//--------------------------------------------------
// Watchlist editor
//--------------------------------------------------

app.get(

    "/watchlist",

    (_, res) => {

        const symbols =
            watchlistStore.get();

        res.json({

            success: true,

            timestamp: new Date().toISOString(),

            count: symbols.length,

            symbols

        });

    }

);

app.put(

    "/watchlist",

    (req, res) => {

        try {

            const body =
                req.body as { symbols?: unknown };

            const symbols =
                watchlistStore.save(body?.symbols);

            console.log(

                `Watchlist updated: ${symbols.length} symbols`

            );

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                count: symbols.length,

                symbols

            });

        } catch (error) {

            console.error(error);

            res.status(400).json({

                success: false,

                timestamp: new Date().toISOString(),

                error:
                    error instanceof Error

                        ? error.message

                        : "Invalid watchlist"

            });

        }

    }

);

//--------------------------------------------------
// Live 0DTE Scan
//--------------------------------------------------

app.get(

    "/scan",

    async (_, res) => {

        try {

            const list =
                watchlistStore.get();

            const results =
                await scanner.scan(list);

            results.sort(

                (a, b) =>

                    b.score - a.score

            );

            const qualified =
                results.filter(

                    result => result.qualified

                ).length;

            res.json({

                success: true,

                timestamp:
                    new Date().toISOString(),

                watchlist:
                    list.length,

                playbooks: 4,

                total:
                    results.length,

                qualified,

                results

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp:
                    new Date().toISOString(),

                error:
                    error instanceof Error

                        ? error.message

                        : "Scanner failed"

            });

        }

    }

);

//--------------------------------------------------
// Swing Scan (Short + Intermediate)
//--------------------------------------------------

app.get(

    "/swing",

    async (_, res) => {

        try {

            const list =
                watchlistStore.get();

            const results =
                await swingScanner.scan(list);

            const qualified =
                results.filter(r => r.qualified).length;

            const watching =
                results.filter(r => r.state === "watching").length;

            res.json({

                success: true,

                timestamp:
                    new Date().toISOString(),

                watchlist:
                    list.length,

                total: results.length,

                qualified,

                watching,

                results

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp:
                    new Date().toISOString(),

                error:
                    error instanceof Error

                        ? error.message

                        : "Swing scanner failed"

            });

        }

    }

);

//--------------------------------------------------
// Relative Volume Leaderboard
//--------------------------------------------------

app.get(

    "/rvol",

    async (_, res) => {

        try {

            const list =
                watchlistStore.get();

            const result =
                await rvolEngine.evaluate(list);

            res.json(result);

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp:
                    new Date().toISOString(),

                error:
                    error instanceof Error

                        ? error.message

                        : "RVOL request failed"

            });

        }

    }

);

//--------------------------------------------------
// Start Server
//--------------------------------------------------

const PORT = 3000;

app.listen(

    PORT,

    () => {

        console.log("");

        console.log("====================================");

        console.log("        SNIPER API v2.4");

        console.log("====================================");

        console.log("");

        console.log(

            `Health    : http://localhost:${PORT}/health`

        );

        console.log(

            `Scan      : http://localhost:${PORT}/scan`

        );

        console.log(

            `Swing     : http://localhost:${PORT}/swing`

        );

        console.log(

            `RVOL      : http://localhost:${PORT}/rvol`

        );

        console.log(

            `Watchlist : http://localhost:${PORT}/watchlist`

        );

        console.log("");

        console.log(

            `Loaded ${watchlistStore.count()} symbols from data/watchlist.json`

        );

        console.log("Ready for React UI");

        console.log("");

    }

);
