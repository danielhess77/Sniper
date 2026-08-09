/**
 * Sniper Journal Resolver
 *
 * Version: 1.1
 *
 * Swings: only evaluate daily bars AFTER the signal/session day.
 * Entry-day low at the stop is structural, not a stop-out.
 */

import { BDKClient, Candle } from "../core/BDKClient.js";
import { journalStore } from "./JournalStore.js";
import type { JournalEntry } from "./JournalTypes.js";

function etDateString(ms: number): string {

    return new Intl.DateTimeFormat("en-CA", {

        timeZone: "America/New_York",

        year: "numeric",

        month: "2-digit",

        day: "2-digit"

    }).format(new Date(ms));

}

function candleMs(c: Candle): number {

    return typeof c.datetime === "number"

        ? c.datetime

        : Date.parse(String(c.datetime));

}

export class JournalResolver {

    private static readonly INTRADAY_MAX_DAYS = 1;

    private static readonly SWING_SHORT_MAX_DAYS = 5;

    private static readonly SWING_INTERMEDIATE_MAX_DAYS = 20;

    constructor(

        private bdk: BDKClient

    ) {}

    async resolveOpen(): Promise<{ checked: number; resolved: number }> {

        const open = journalStore.getOpen();

        let resolved = 0;

        const bySymbol = new Map<string, JournalEntry[]>();

        for (const e of open) {

            if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);

            bySymbol.get(e.symbol)!.push(e);

        }

        for (const [symbol, entries] of bySymbol) {

            let daily: Candle[] = [];

            try {

                // Need enough history for intermediate swings
                daily = await this.bdk.getDailyHistory(symbol, 2);

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

        const signalDay =
            entry.sessionDate ||
            etDateString(Date.parse(entry.loggedAt));

        /**
         * Swing / daily path: ONLY bars with ET date STRICTLY AFTER signal day.
         * Intraday journal rows also use daily here as a coarse fallback —
         * still skip signal day to avoid same-bar false stops.
         */
        const bars = daily

            .filter(c => {

                const ms = candleMs(c);

                if (!Number.isFinite(ms)) return false;

                const barDay = etDateString(ms);

                return barDay > signalDay;

            })

            .sort((a, b) => candleMs(a) - candleMs(b));

        for (const bar of bars) {

            if (entry.direction === "BULLISH") {

                const hitStop = bar.low <= entry.stop;

                const hitTarget = bar.high >= entry.target;

                // Same later bar tags both: conservative stop-first
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

        const maxDays =
            entry.scope === "intraday"

                ? JournalResolver.INTRADAY_MAX_DAYS

                : entry.horizonId === "INTERMEDIATE"

                    ? JournalResolver.SWING_INTERMEDIATE_MAX_DAYS

                    : JournalResolver.SWING_SHORT_MAX_DAYS;

        // Age from signal session, not log clock (weekend logs shouldn't age out early)
        const signalMs = Date.parse(`${signalDay}T16:00:00-04:00`);

        const ageDays =
            (Date.now() - (Number.isFinite(signalMs) ? signalMs : Date.parse(entry.loggedAt))) /
            (24 * 60 * 60 * 1000);

        if (ageDays >= maxDays) {

            // Prefer last post-signal bar; else last available daily close
            const last =
                bars.length

                    ? bars[bars.length - 1]

                    : daily.length

                        ? daily[daily.length - 1]

                        : null;

            if (!last) return null;

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

        // Still open — no post-signal path hit yet (e.g. weekend after Friday signal)
        return null;

    }

}
