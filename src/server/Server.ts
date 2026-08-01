/**
 * Sniper Server v2.1
 *
 * Express API for the Sniper scanner.
 */

import express from "express";
import cors from "cors";

import { BDKClient } from "../core/BDKClient.js";
import { Scanner } from "../core/Scanner.js";

import { WATCHLIST } from "../config/Watchlist.js";

import { TrendContinuation } from "../playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "../playbooks/OpeningRangeBreakout.js";
import { VWAPReclaim } from "../playbooks/VWAPReclaim.js";
import { FirstPullback } from "../playbooks/FirstPullback.js";

const app = express();

app.use(cors());

const scanner = new Scanner(

    new BDKClient(),

    [

        new TrendContinuation(),

        new OpeningRangeBreakout(),

        new VWAPReclaim(),

        new FirstPullback()

    ]

);

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
// Live Scan
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
// Start Server
//--------------------------------------------------

const PORT = 3000;

app.listen(

    PORT,

    () => {

        console.log("");

        console.log("====================================");

        console.log("        SNIPER API v2.1");

        console.log("====================================");

        console.log("");

        console.log(

            `Health : http://localhost:${PORT}/health`

        );

        console.log(

            `Scan   : http://localhost:${PORT}/scan`

        );

        console.log("");

        console.log("Ready for React UI");

        console.log("");

    }

);