/**
 * Sniper
 * Scanner
 *
 * Version: 2.5
 */

import { BDKClient } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import type { ScanCard } from "../types.js";
import { normalizeScan } from "./ScanNormalizer.js";

export type ScanResult = ScanCard;

export class Scanner {

    constructor(

        private bdk: BDKClient,

        private playbooks: Playbook<any>[]

    ) {}

    async scan(
        symbols: string[]
    ): Promise<ScanResult[]> {

        console.log("");
        console.log("========================================");
        console.log(`Scanning ${symbols.length} symbols...`);
        console.log("========================================");
        console.log("");

        const histories = await Promise.all(

            symbols.map(async symbol => ({

                symbol,

                candles:
                    await this.bdk.getHistory(symbol)

            }))

        );

        const results: ScanResult[] = [];

        //--------------------------------------------------
        // Run Playbooks
        //--------------------------------------------------

        for (const history of histories) {

            console.log("");
            console.log(`========== ${history.symbol} ==========`);

            for (const playbook of this.playbooks) {

                try {

                    //--------------------------------------------------
                    // Evaluate
                    //--------------------------------------------------

                    const result =
                        playbook.evaluate(
                            history.candles
                        );

                    //--------------------------------------------------
                    // Decision Trace
                    //--------------------------------------------------

                    const trace =
                        playbook.trace(
                            result
                        );

                    console.log("");
                    console.log(
                        `--- ${result.playbook} ---`
                    );

                    for (const step of trace.steps) {

                        console.log(
                            `${step.passed ? "✓" : "✗"} ${step.name}`
                        );

                        if (step.value) {

                            console.log(
                                `    Value : ${step.value}`
                            );

                        }

                        if (step.reason) {

                            console.log(
                                `    ${step.reason}`
                            );

                        }

                    }

                    //--------------------------------------------------
                    // Validation
                    //--------------------------------------------------

                    const validation =
                        playbook.validate(
                            history.candles,
                            result
                        );

                    console.log("");

                    if (validation.active) {

                        console.log("FINAL: PASS");

                    }

                    else {

                        console.log(
                            `FINAL: FAIL (${validation.reason})`
                        );

                    }

                    if (!validation.active) {

                        continue;

                    }

                    //--------------------------------------------------
                    // Save Qualified Setup
                    //--------------------------------------------------

                    results.push(

                        normalizeScan(

                            history.symbol,

                            result,

                            history.candles

                        )

                    );

                }

                catch (error) {

                    console.error("");
                    console.error(
                        `--- ${playbook.constructor.name} FAILED ---`
                    );
                    console.error(
                        `Symbol: ${history.symbol}`
                    );
                    console.error(error);

                    continue;

                }

            }

        }

        console.log("");
        console.log("========================================");
        console.log(
            `Qualified Setups: ${results.length}`
        );
        console.log("========================================");
        console.log("");

        return results;

    }

}