/**
 * Sniper
 * Scanner
 *
 * Version: 2.11
 *
 * validate() is informational — does not hide a same-day qualified setup.
 * (Previously midday "lost structure" wiped the whole board.)
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import type { ScanCard } from "../types.js";
import { normalizeScan } from "./ScanNormalizer.js";
import { OptionSelectEngine } from "../engines/OptionSelectEngine.js";
import { etCalendarDay } from "./SessionDay.js";
import { MarketSession } from "../utils/MarketSession.js";

export type ScanResult = ScanCard;

function candlesForIntradayEval(candles: Candle[]): Candle[] {

    const today = etCalendarDay();

    const todayBars = MarketSession.getSessionDay(candles, today);

    if (todayBars.length >= 20) {

        return todayBars;

    }

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

        const todayEt = etCalendarDay();

        console.log("");
        console.log("========================================");
        console.log(`Scanning ${symbols.length} symbols (throttled)...`);
        console.log(`Session: ${todayEt} ET — structure-first qualify`);
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

            const evalCandles =
                candlesForIntradayEval(history.candles);

            if (evalCandles.length < 15) {

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

                    // Hard reject only when stop-side structure is clearly broken
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
