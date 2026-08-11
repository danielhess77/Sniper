/**
 * Sniper
 * Scanner
 *
 * Version: 2.12
 *
 * Logs first/last bar ET + RTH/OR counts so incomplete history is obvious.
 * Session day for OR/eval prefers the last candle's ET date (data-driven).
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import type { ScanCard } from "../types.js";
import { normalizeScan } from "./ScanNormalizer.js";
import { OptionSelectEngine } from "../engines/OptionSelectEngine.js";
import { etCalendarDay } from "./SessionDay.js";
import { MarketSession, OPENING_RANGE_MINUTES } from "../utils/MarketSession.js";

export type ScanResult = ScanCard;

function formatEtClock(ms: number): string {

    if (!Number.isFinite(ms) || ms <= 0) return "?";

    return new Date(ms).toLocaleTimeString("en-US", {

        timeZone: "America/New_York",

        hour: "numeric",

        minute: "2-digit",

        second: "2-digit"

    });

}

function sessionDayFromData(candles: Candle[]): string {

    if (!candles.length) return etCalendarDay();

    const last = candles[candles.length - 1];

    const ms = Number(last.datetime);

    if (!Number.isFinite(ms) || ms <= 0) return etCalendarDay();

    return etCalendarDay(ms);

}

function describeBars(

    symbol: string,

    rawCount: number,

    evalCandles: Candle[],

    dayEt: string

): void {

    if (evalCandles.length === 0) {

        console.log(

            `${symbol} history: raw=${rawCount} eval=0 | no bars for session ${dayEt}`

        );

        return;

    }

    const sorted = [...evalCandles].sort(

        (a, b) => Number(a.datetime) - Number(b.datetime)

    );

    const firstMs = Number(sorted[0].datetime);

    const lastMs = Number(sorted[sorted.length - 1].datetime);

    const rth = sorted.filter(c => MarketSession.isRegularSession(c));

    const orWindow = rth.filter(c =>

        MarketSession.isOpeningRange(c, OPENING_RANGE_MINUTES)

    );

    const postOr = rth.filter(c =>

        MarketSession.getSessionMinute(c) >= OPENING_RANGE_MINUTES

    );

    console.log(

        `${symbol} history: raw=${rawCount} eval=${sorted.length} | ` +

        `first=${formatEtClock(firstMs)} last=${formatEtClock(lastMs)} ET | ` +

        `RTH=${rth.length} OR-window=${orWindow.length} post-10:00=${postOr.length} | day=${dayEt}`

    );

    if (orWindow.length === 0 && rth.length > 0) {

        const mins = rth.slice(0, 3).map(c =>

            MarketSession.getSessionMinute(c)

        );

        console.log(

            `${symbol} WARN: no 9:30–10:00 bars — sample sessionMinutes=${mins.join(",")}`

        );

    }

}

function candlesForIntradayEval(

    candles: Candle[],

    dayEt: string

): Candle[] {

    const todayBars = MarketSession.getSessionDay(candles, dayEt);

    if (todayBars.length >= 15) {

        return todayBars;

    }

    // Sparse today: keep short prior tail for gap context
    const sorted = [...candles].sort(

        (a, b) => Number(a.datetime) - Number(b.datetime)

    );

    const todayStart = todayBars.length

        ? Number(todayBars[0].datetime)

        : Date.now();

    const prior = sorted.filter(c => Number(c.datetime) < todayStart);

    const tail = prior.slice(-40);

    return [...tail, ...todayBars];

}

export class Scanner {

    private optionSelect: OptionSelectEngine;

    constructor(

        private bdk: BDKClient,

        private playbooks: Playbook<any>[]

    ) {

        this.optionSelect = new OptionSelectEngine(bdk);

    }

    async scan(
        symbols: string[]
    ): Promise<ScanResult[]> {

        const clockDay = etCalendarDay();

        console.log("");
        console.log("========================================");
        console.log(`Scanning ${symbols.length} symbols (throttled)...`);
        console.log(`Clock day: ${clockDay} ET — bar diagnostics on`);
        console.log("========================================");

        const histories: { symbol: string; candles: Candle[] }[] = [];

        for (const symbol of symbols) {

            try {

                const candles = await this.bdk.getHistory(symbol);

                histories.push({ symbol, candles });

            } catch (err) {

                const msg = err instanceof Error ? err.message : String(err);

                console.error(`History failed: ${symbol} — ${msg.slice(0, 140)}`);

                histories.push({ symbol, candles: [] });

            }

        }

        const failed = histories.filter(h => h.candles.length === 0).length;

        if (failed > 0) {

            console.warn(`History empty/failed for ${failed}/${symbols.length} symbols`);

        }

        const results: ScanResult[] = [];

        for (const history of histories) {

            if (history.candles.length === 0) {

                console.log(`${history.symbol} history: raw=0 | skip`);

                continue;

            }

            // Prefer the session day present in the data (last bar)
            const dayEt = sessionDayFromData(history.candles);

            const evalCandles =
                candlesForIntradayEval(history.candles, dayEt);

            describeBars(

                history.symbol,

                history.candles.length,

                evalCandles,

                dayEt

            );

            if (evalCandles.length < 15) {

                console.log(`${history.symbol} skip: eval bars < 15`);

                continue;

            }

            console.log("");
            console.log(`========== ${history.symbol} (${evalCandles.length} bars) ==========`);

            for (const playbook of this.playbooks) {

                try {

                    const result =
                        playbook.evaluate(evalCandles);

                    const trace =
                        playbook.trace(result);

                    console.log("");
                    console.log(`--- ${result.playbook} ---`);

                    for (const step of trace.steps) {

                        console.log(`${step.passed ? "✓" : "✗"} ${step.name}`);

                        if (step.value) console.log(`    Value : ${step.value}`);

                        if (step.reason) console.log(`    ${step.reason}`);

                    }

                    if (!result.qualified) {

                        console.log("FINAL: not qualified by playbook");

                        continue;

                    }

                    const validation =
                        playbook.validate(evalCandles, result);

                    if (!validation.active) {

                        console.log(`VALIDATE soft-fail: ${validation.reason} (still listing if today)`);

                    } else {

                        console.log("FINAL: PASS");

                    }

                    if (

                        !validation.active &&
                        /stop|broke or low|broke or high|re-broke/i.test(
                            validation.reason
                        )

                    ) {

                        console.log("FINAL: hard-fail validate — skip");

                        continue;

                    }

                    const card =
                        normalizeScan(

                            history.symbol,

                            result,

                            evalCandles

                        );

                    if (!card.qualified) {

                        console.log("SESSION GATE: skip (not today ET)");

                        continue;

                    }

                    results.push(card);

                } catch (error) {

                    console.error(`--- ${playbook.constructor.name} FAILED --`);

                    console.error(`Symbol: ${history.symbol}`);

                    console.error(error);

                    continue;

                }

            }

        }

        for (const card of results) {

            if (!card.qualified) continue;

            if (card.direction !== "BULLISH" && card.direction !== "BEARISH") {

                continue;

            }

            try {

                card.option =
                    await this.optionSelect.suggest(

                        card.symbol,

                        card.direction

                    );

            } catch (err) {

                console.error(`Option enrich failed: ${card.symbol}`, err);

                card.option = null;

            }

        }

        console.log("");
        console.log("========================================");
        console.log(`Qualified Setups (today ET): ${results.length}`);
        console.log("========================================");

        return results;

    }

}
