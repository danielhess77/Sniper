/**
 * Sniper Server v2.7
 *
 * Express API: scan + swing + RVOL + watchlist + trade journal.
 */

import express from "express";
import cors from "cors";

import { BDKClient } from "../core/BDKClient.js";
import { Scanner } from "../core/Scanner.js";
import { SwingScanner } from "../core/SwingScanner.js";
import { RvolEngine } from "../engines/RvolEngine.js";

import { watchlistStore } from "../config/WatchlistStore.js";
import { journalStore } from "../journal/JournalStore.js";
import { JournalResolver } from "../journal/JournalResolver.js";
import type { TakenStatus } from "../journal/JournalTypes.js";

import { TrendContinuation } from "../playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "../playbooks/OpeningRangeBreakout.js";
import { FailedOpeningRangeBreakout } from "../playbooks/FailedOpeningRangeBreakout.js";
import { OpeningDriveHold } from "../playbooks/OpeningDriveHold.js";
import { VWAPReclaim } from "../playbooks/VWAPReclaim.js";
import { FirstPullback } from "../playbooks/FirstPullback.js";

const app = express();

app.use(cors());

app.use(express.json({ limit: "64kb" }));

watchlistStore.load();

journalStore.load();

const bdk = new BDKClient();

const journalResolver = new JournalResolver(bdk);

const PLAYBOOKS = [

    new TrendContinuation(),

    new OpeningRangeBreakout(),

    new FailedOpeningRangeBreakout(),

    new OpeningDriveHold(),

    new VWAPReclaim(),

    new FirstPullback()

];

const scanner = new Scanner(bdk, PLAYBOOKS);

const swingScanner = new SwingScanner(bdk);

const rvolEngine = new RvolEngine(bdk);

app.get(

    "/health",

    (_, res) => {

        res.json({

            success: true,

            status: "ok",

            timestamp: new Date().toISOString(),

            watchlist: watchlistStore.count(),

            playbooks: PLAYBOOKS.length,

            journal: journalStore.list().length

        });

    }

);

app.get(

    "/watchlist",

    (_, res) => {

        const symbols = watchlistStore.get();

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

            const body = req.body as { symbols?: unknown };

            const symbols = watchlistStore.save(body?.symbols);

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                count: symbols.length,

                symbols

            });

        } catch (error) {

            res.status(400).json({

                success: false,

                timestamp: new Date().toISOString(),

                error: error instanceof Error ? error.message : "Invalid watchlist"

            });

        }

    }

);

//--------------------------------------------------
// Journal
//--------------------------------------------------

app.get(

    "/journal",

    (_, res) => {

        res.json({

            success: true,

            timestamp: new Date().toISOString(),

            entries: journalStore.list(),

            summary: journalStore.summary()

        });

    }

);

app.patch(

    "/journal/:id",

    (req, res) => {

        try {

            const id = req.params.id;

            const body = req.body as {

                taken?: TakenStatus;

                notes?: string;

            };

            let row = null as ReturnType<typeof journalStore.setTaken>;

            if (

                body.taken === "yes" ||
                body.taken === "no" ||
                body.taken === "unknown"

            ) {

                row = journalStore.setTaken(id, body.taken);

            }

            if (typeof body.notes === "string") {

                row = journalStore.setNotes(id, body.notes);

            }

            if (!row) {

                res.status(404).json({

                    success: false,

                    error: "Journal entry not found"

                });

                return;

            }

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                entry: row,

                summary: journalStore.summary()

            });

        } catch (error) {

            res.status(400).json({

                success: false,

                error: error instanceof Error ? error.message : "Update failed"

            });

        }

    }

);

app.post(

    "/journal/resolve",

    async (_, res) => {

        try {

            const result = await journalResolver.resolveOpen();

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                ...result,

                summary: journalStore.summary(),

                entries: journalStore.list()

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error: error instanceof Error ? error.message : "Resolve failed"

            });

        }

    }

);

app.get(

    "/scan",

    async (_, res) => {

        try {

            const list = watchlistStore.get();

            const results = await scanner.scan(list);

            results.sort((a, b) => b.score - a.score);

            let logged = 0;

            for (const r of results) {

                if (!r.qualified) continue;

                const created = journalStore.logQualified({

                    scope: "intraday",

                    symbol: r.symbol,

                    playbook: r.playbook,

                    setupType: r.playbook,

                    direction: r.direction,

                    entry: r.entry,

                    stop: r.stop,

                    target: r.target,

                    riskReward: r.riskReward,

                    score: r.score

                });

                if (created) logged++;

            }

            // Opportunistic resolve (cheap if few open)
            try {

                await journalResolver.resolveOpen();

            } catch {

                // non-fatal

            }

            const qualified = results.filter(r => r.qualified).length;

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                watchlist: list.length,

                playbooks: PLAYBOOKS.length,

                total: results.length,

                qualified,

                journalLogged: logged,

                results

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp: new Date().toISOString(),

                error: error instanceof Error ? error.message : "Scanner failed"

            });

        }

    }

);

app.get(

    "/swing",

    async (_, res) => {

        try {

            const list = watchlistStore.get();

            const results = await swingScanner.scan(list);

            let logged = 0;

            for (const r of results) {

                if (!r.qualified) continue;

                const created = journalStore.logQualified({

                    scope: "swing",

                    symbol: r.symbol,

                    playbook: `${r.horizon} · ${r.setupType || "PULLBACK"}`,

                    setupType: r.setupType || "PULLBACK",

                    horizonId: r.horizonId,

                    direction: r.direction === "BULLISH" ? "BULLISH" : "NONE",

                    entry: r.entry,

                    stop: r.stop,

                    target: r.target,

                    riskReward: r.riskReward,

                    score: r.score,

                    rsRank: r.rsRank

                });

                if (created) logged++;

            }

            try {

                await journalResolver.resolveOpen();

            } catch {

                // non-fatal

            }

            res.json({

                success: true,

                timestamp: new Date().toISOString(),

                watchlist: list.length,

                total: results.length,

                qualified: results.filter(r => r.qualified).length,

                watching: results.filter(r => r.state === "watching").length,

                journalLogged: logged,

                results

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                timestamp: new Date().toISOString(),

                error: error instanceof Error ? error.message : "Swing scanner failed"

            });

        }

    }

);

app.get(

    "/rvol",

    async (_, res) => {

        try {

            const list = watchlistStore.get();

            const result = await rvolEngine.evaluate(list);

            res.json(result);

        } catch (error) {

            res.status(500).json({

                success: false,

                timestamp: new Date().toISOString(),

                error: error instanceof Error ? error.message : "RVOL request failed"

            });

        }

    }

);

const PORT = 3000;

app.listen(PORT, () => {

    console.log("");

    console.log("====================================");

    console.log("        SNIPER API v2.7");

    console.log("====================================");

    console.log(`Health    : http://localhost:${PORT}/health`);

    console.log(`Scan      : http://localhost:${PORT}/scan`);

    console.log(`Swing     : http://localhost:${PORT}/swing`);

    console.log(`RVOL      : http://localhost:${PORT}/rvol`);

    console.log(`Watchlist : http://localhost:${PORT}/watchlist`);

    console.log(`Journal   : http://localhost:${PORT}/journal`);

    console.log(`Playbooks : ${PLAYBOOKS.length}`);

    console.log(`Journal   : ${journalStore.list().length} entries`);

    console.log("Ready for React UI");

    console.log("");

});
