/**
 * Sniper Journal Resolver
 *
 * Version: 1.2
 *
 * Intraday: resolve vs live quote (same-day 0DTE never had a "next daily").
 * Swing: only daily bars STRICTLY AFTER signal day (avoid entry-day false stops).
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

        if (open.length === 0) {

            return { checked: 0, resolved: 0 };

        }

        const intraday = open.filter(e => e.scope === "intraday");

        const swings = open.filter(e => e.scope !== "intraday");

        // —— Intraday: live quotes (same-day path) ——
        if (intraday.length > 0) {

            const symbols = [...new Set(intraday.map(e => e.symbol))];

            let quotes: Awaited<ReturnType<BDKClient["getQuotes"]>> = [];

            try {

                quotes = await this.bdk.getQuotes(symbols);

            } catch (err) {

                console.error("Journal resolve quotes failed", err);

            }

            const priceBySym = new Map(

                quotes.map(q => [q.symbol.toUpperCase(), q.lastPrice] as const)

            );

            for (const entry of intraday) {

                const px = priceBySym.get(entry.symbol.toUpperCase());

                const result =
                    this.resolveIntraday(entry, px);

                if (result) {

                    journalStore.resolve(

                        entry.id,

                        result.outcome,

                        result.exitPrice,

                        result.rMultiple

                    );

                    resolved++;

                    console.log(

                        `Journal resolved ${entry.symbol} ${entry.playbook}: ` +

                        `${result.outcome} R=${result.rMultiple.toFixed(2)} @ ${result.exitPrice}`

                    );

                }

            }

        }

        // —— Swing: daily bars after signal day ——
        const bySymbol = new Map<string, JournalEntry[]>();

        for (const e of swings) {

            if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);

            bySymbol.get(e.symbol)!.push(e);

        }

        for (const [symbol, entries] of bySymbol) {

            let daily: Candle[] = [];

            try {

                daily = await this.bdk.getDailyHistory(symbol, 2);

            } catch (err) {

                console.error(`Journal resolve history failed: ${symbol}`, err);

                continue;

            }

            for (const entry of entries) {

                const result = this.resolveSwing(entry, daily);

                if (result) {

                    journalStore.resolve(

                        entry.id,

                        result.outcome,

                        result.exitPrice,

                        result.rMultiple

                    );

                    resolved++;

                    console.log(

                        `Journal resolved ${entry.symbol} ${entry.playbook}: ` +

                        `${result.outcome} R=${result.rMultiple.toFixed(2)} @ ${result.exitPrice}`

                    );

                }

            }

        }

        console.log(`Journal resolve: checked=${open.length} resolved=${resolved}`);

        return { checked: open.length, resolved };

    }

    /**
     * 0DTE / intraday: mark stop or target if last price has breached.
     * If past max age with no breach → expired at last price.
     */
    private resolveIntraday(

        entry: JournalEntry,

        lastPrice: number | undefined

    ): { outcome: "target" | "stop" | "expired"; exitPrice: number; rMultiple: number } | null {

        const risk = Math.abs(entry.entry - entry.stop);

        if (risk <= 0) return null;

        const signalDay =
            entry.sessionDate ||
            etDateString(Date.parse(entry.loggedAt));

        const signalMs = Date.parse(`${signalDay}T09:30:00-04:00`);

        const ageDays =
            (Date.now() - (Number.isFinite(signalMs) ? signalMs : Date.parse(entry.loggedAt))) /
            (24 * 60 * 60 * 1000);

        if (typeof lastPrice === "number" && lastPrice > 0) {

            if (entry.direction === "BULLISH") {

                if (lastPrice <= entry.stop) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (lastPrice >= entry.target) {

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: (entry.target - entry.entry) / risk

                    };

                }

            } else if (entry.direction === "BEARISH") {

                if (lastPrice >= entry.stop) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (lastPrice <= entry.target) {

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: (entry.entry - entry.target) / risk

                    };

                }

            }

            // Past session window — mark to market
            if (ageDays >= JournalResolver.INTRADAY_MAX_DAYS) {

                const r =
                    entry.direction === "BULLISH"

                        ? (lastPrice - entry.entry) / risk

                        : (entry.entry - lastPrice) / risk;

                return {

                    outcome: "expired",

                    exitPrice: lastPrice,

                    rMultiple: r

                };

            }

            return null; // still open, between stop and target

        }

        // No quote — only expire by age using entry as proxy (weak)
        if (ageDays >= JournalResolver.INTRADAY_MAX_DAYS) {

            return {

                outcome: "expired",

                exitPrice: entry.entry,

                rMultiple: 0

            };

        }

        return null;

    }

    private resolveSwing(

        entry: JournalEntry,

        daily: Candle[]

    ): { outcome: "target" | "stop" | "expired"; exitPrice: number; rMultiple: number } | null {

        const risk = Math.abs(entry.entry - entry.stop);

        if (risk <= 0) return null;

        const signalDay =
            entry.sessionDate ||
            etDateString(Date.parse(entry.loggedAt));

        const bars = daily

            .filter(c => {

                const ms = candleMs(c);

                if (!Number.isFinite(ms)) return false;

                return etDateString(ms) > signalDay;

            })

            .sort((a, b) => candleMs(a) - candleMs(b));

        for (const bar of bars) {

            if (entry.direction === "BULLISH") {

                const hitStop = bar.low <= entry.stop;

                const hitTarget = bar.high >= entry.target;

                if (hitStop && hitTarget) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (hitStop) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (hitTarget) {

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: (entry.target - entry.entry) / risk

                    };

                }

            } else if (entry.direction === "BEARISH") {

                const hitStop = bar.high >= entry.stop;

                const hitTarget = bar.low <= entry.target;

                if (hitStop && hitTarget) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (hitStop) {

                    return { outcome: "stop", exitPrice: entry.stop, rMultiple: -1 };

                }

                if (hitTarget) {

                    return {

                        outcome: "target",

                        exitPrice: entry.target,

                        rMultiple: (entry.entry - entry.target) / risk

                    };

                }

            }

        }

        const maxDays =
            entry.horizonId === "INTERMEDIATE"

                ? JournalResolver.SWING_INTERMEDIATE_MAX_DAYS

                : JournalResolver.SWING_SHORT_MAX_DAYS;

        const signalMs = Date.parse(`${signalDay}T16:00:00-04:00`);

        const ageDays =
            (Date.now() - (Number.isFinite(signalMs) ? signalMs : Date.parse(entry.loggedAt))) /
            (24 * 60 * 60 * 1000);

        if (ageDays >= maxDays) {

            const last =
                bars.length

                    ? bars[bars.length - 1]

                    : daily.length

                        ? daily[daily.length - 1]

                        : null;

            if (!last) return null;

            const exit = last.close;

            const r =
                entry.direction === "BULLISH"

                    ? (exit - entry.entry) / risk

                    : (entry.entry - exit) / risk;

            return { outcome: "expired", exitPrice: exit, rMultiple: r };

        }

        return null;

    }

}
