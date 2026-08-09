/**
 * Sniper Journal Resolver
 *
 * Version: 1.0
 *
 * Resolves open journal entries against subsequent price history.
 * Hit stop vs target by bar path; expire after max sessions.
 */

import { BDKClient, Candle } from "../core/BDKClient.js";
import { journalStore } from "./JournalStore.js";
import type { JournalEntry } from "./JournalTypes.js";

export class JournalResolver {

    /** Intraday: expire same session after this many ET calendar days from log */
    private static readonly INTRADAY_MAX_DAYS = 1;

    private static readonly SWING_SHORT_MAX_DAYS = 5;

    private static readonly SWING_INTERMEDIATE_MAX_DAYS = 20;

    constructor(

        private bdk: BDKClient

    ) {}

    async resolveOpen(): Promise<{ checked: number; resolved: number }> {

        const open = journalStore.getOpen();

        let resolved = 0;

        // Group by symbol to limit API calls
        const bySymbol = new Map<string, JournalEntry[]>();

        for (const e of open) {

            if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);

            bySymbol.get(e.symbol)!.push(e);

        }

        for (const [symbol, entries] of bySymbol) {

            let daily: Candle[] = [];

            try {

                daily = await this.bdk.getDailyHistory(symbol, 3);

            } catch (err) {

                console.error(`Journal resolve history failed: ${symbol}`, err);

                continue;

            }

            for (const entry of entries) {

                const result = this.resolveOne(entry, daily);

                if (result) {

                    journalStore.resolve(

                        entry.id,

                        result.outcome,

                        result.exitPrice,

                        result.rMultiple

                    );

                    resolved++;

                }

            }

        }

        return { checked: open.length, resolved };

    }

    private resolveOne(

        entry: JournalEntry,

        daily: Candle[]

    ): { outcome: "target" | "stop" | "expired"; exitPrice: number; rMultiple: number } | null {

        const risk = Math.abs(entry.entry - entry.stop);

        if (risk <= 0) return null;

        const loggedMs = Date.parse(entry.loggedAt);

        // Bars on/after session date
        const bars = daily.filter(c => {

            const t = typeof c.datetime === "number" ? c.datetime : Date.parse(String(c.datetime));

            // Include bar if on or after log day (daily bars are coarse)
            return t >= loggedMs - 12 * 60 * 60 * 1000;

        });

        if (!bars.length) {

            // Try all daily if filter empty
            bars.push(...daily.slice(-10));

        }

        for (const bar of bars) {

            if (entry.direction === "BULLISH") {

                const hitStop = bar.low <= entry.stop;

                const hitTarget = bar.high >= entry.target;

                if (hitStop && hitTarget) {

                    // Conservative: assume stop first on same bar
                    return {

                        outcome: "stop",

                        exitPrice: entry.stop,

                        rMultiple: -1

                    };

                }

                if (hitStop) {

                    return {

                        outcome: "stop",

                        exitPrice: entry.stop,

                        rMultiple: -1

                    };

                }

                if (hitTarget) {

                    const reward = entry.target - entry.entry;

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: reward / risk

                    };

                }

            } else if (entry.direction === "BEARISH") {

                const hitStop = bar.high >= entry.stop;

                const hitTarget = bar.low <= entry.target;

                if (hitStop && hitTarget) {

                    return {

                        outcome: "stop",

                        exitPrice: entry.stop,

                        rMultiple: -1

                    };

                }

                if (hitStop) {

                    return {

                        outcome: "stop",

                        exitPrice: entry.stop,

                        rMultiple: -1

                    };

                }

                if (hitTarget) {

                    const reward = entry.entry - entry.target;

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: reward / risk

                    };

                }

            }

        }

        // Expire?
        const maxDays =
            entry.scope === "intraday"

                ? JournalResolver.INTRADAY_MAX_DAYS

                : entry.horizonId === "INTERMEDIATE"

                    ? JournalResolver.SWING_INTERMEDIATE_MAX_DAYS

                    : JournalResolver.SWING_SHORT_MAX_DAYS;

        const ageDays =
            (Date.now() - loggedMs) / (24 * 60 * 60 * 1000);

        if (ageDays >= maxDays && bars.length) {

            const last = bars[bars.length - 1];

            const exit = last.close;

            let r: number;

            if (entry.direction === "BULLISH") {

                r = (exit - entry.entry) / risk;

            } else {

                r = (entry.entry - exit) / risk;

            }

            return {

                outcome: "expired",

                exitPrice: exit,

                rMultiple: r

            };

        }

        return null;

    }

}
