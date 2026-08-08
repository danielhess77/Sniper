/**
 * Sniper Server v2.3
 *
 * Express API: 0DTE scan + RVOL + Swing scanner.
 */

import express from "express";
import cors from "cors";

import { BDKClient } from "../core/BDKClient.js";
import { Scanner } from "../core/Scanner.js";
import { SwingScanner } from "../core/SwingScanner.js";
import { RvolEngine } from "../engines/RvolEngine.js";

import { WATCHLIST } from "../config/Watchlist.js";

import { TrendContinuation } from "../playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "../playbooks/OpeningRangeBreakout.js";
import { VWAPReclaim } from "../playbooks/VWAPReclaim.js";
import { FirstPullback } from "../playbooks/FirstPullback.js";

const app = express();

app.use(cors());

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

            timestamp: new Date().toISOString()

        });

    }

);

//--------------------------------------------------
// Live 0DTE Scan
//--------------------------------------------------

app.get(

    "/scan",

    async (_, res) => {

        try {

            const results =
                await scanner.scan(WATCHLIST);

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
                    WATCHLIST.length,

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
                    "Scanner failed"

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

            const results =
                await swingScanner.scan(WATCHLIST);

            const qualified =
                results.filter(r => r.qualified).length;

            const watching =
                results.filter(r => r.state === "watching").length;

            res.json({

                success: true,

                timestamp:
                    new Date().toISOString(),

                watchlist:
                    WATCHLIST.length,

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
                    "Swing scanner failed"

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

            const result =
                await rvolEngine.evaluate(WATCHLIST);

            res.json(result);

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp:
                    new Date().toISOString(),

                error:
                    "RVOL request failed"

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

        console.log("        SNIPER API v2.3");

        console.log("====================================");

        console.log("");

        console.log(

            `Health : http://localhost:${PORT}/health`

        );

        console.log(

            `Scan   : http://localhost:${PORT}/scan`

        );

        console.log(

            `Swing  : http://localhost:${PORT}/swing`

        );

        console.log(

            `RVOL   : http://localhost:${PORT}/rvol`

        );

        console.log("");

        console.log("Ready for React UI");

        console.log("");

    }

);
