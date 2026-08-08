/**
 * Sniper
 * Scanner
 *
 * Version: 2.6
 *
 * After playbooks qualify, attach a long call/put suggestion
 * from the option chain (rate-limit friendly: only qualified).
 */

import { BDKClient } from "./BDKClient.js";
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
        console.log(`Scanning ${symbols.length} symbols...`);
        console.log("========================================");

        const histories = await Promise.all(

            symbols.map(async symbol => ({

                symbol,

                candles: await this.bdk.getHistory(symbol)

            }))

        );

        const results: ScanResult[] = [];

        for (const history of histories) {

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

        // Option suggestions only for qualified directional setups
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
