/**
 * Sniper
 * Scanner
 *
 * Version: 2.8
 *
 * Sequential history fetches (BDK throttle handles gap).
 * One failure does not abort the scan.
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import type { ScanCard } from "../types.js";
import { normalizeScan } from "./ScanNormalizer.js";
import { OptionSelectEngine } from "../engines/OptionSelectEngine.js";

export type ScanResult = ScanCard;

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

        console.log("");
        console.log("========================================");
        console.log(`Scanning ${symbols.length} symbols (throttled)...`);
        console.log("========================================");

        const histories: { symbol: string; candles: Candle[] }[] = [];

        // Sequential — bdkThrottle still serializes, but this avoids
        // queueing 35 refreshes at once when the scan starts
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

            if (history.candles.length < 30) {

                continue;

            }

            console.log("");
            console.log(`========== ${history.symbol} ==========`);

            for (const playbook of this.playbooks) {

                try {

                    const result =
                        playbook.evaluate(history.candles);

                    const trace =
                        playbook.trace(result);

                    console.log("");
                    console.log(`--- ${result.playbook} ---`);

                    for (const step of trace.steps) {

                        console.log(`${step.passed ? "✓" : "✗"} ${step.name}`);

                        if (step.value) console.log(`    Value : ${step.value}`);

                        if (step.reason) console.log(`    ${step.reason}`);

                    }

                    const validation =
                        playbook.validate(history.candles, result);

                    console.log("");

                    if (validation.active) {

                        console.log("FINAL: PASS");

                    } else {

                        console.log(`FINAL: FAIL (${validation.reason})`);

                    }

                    if (!validation.active) {

                        continue;

                    }

                    results.push(

                        normalizeScan(

                            history.symbol,

                            result,

                            history.candles

                        )

                    );

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
        console.log(`Qualified Setups: ${results.length}`);
        console.log("========================================");

        return results;

    }

}
