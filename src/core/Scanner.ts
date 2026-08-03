/**
 * Sniper
 * Scanner
 *
 * Version: 2.1
 */

import { BDKClient } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import type { ScanCard } from "../types.js";
import { normalizeScan } from "./ScanNormalizer.js";
import { PremarketEngine } from "../engines/PremarketEngine.js";

export type ScanResult = ScanCard;

export class Scanner {

    private premarket =
        new PremarketEngine();

    constructor(

        private bdk: BDKClient,

        private playbooks: Playbook<any>[]

    ) {}

    async scan(
        symbols: string[]
    ): Promise<ScanResult[]> {

        const histories = await Promise.all(

            symbols.map(async symbol => ({

                symbol,

                candles:
                    await this.bdk.getHistory(symbol)

            }))

        );

        //--------------------------------------------------
        // Debug
        //--------------------------------------------------

        for (const history of histories) {

            const latest =
                history.candles[
                    history.candles.length - 1
                ];

            if (!latest) {

                continue;

            }

            const premarket =
                this.premarket.evaluate(
                    history.candles
                );

            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                history.symbol
            );

            console.log("");

            console.log(
                "Latest Candle :",
                new Date(
                    latest.datetime
                ).toLocaleString(
                    "en-US",
                    {
                        timeZone:
                            "America/New_York"
                    }
                )
            );

            console.log(
                "Current Price :",
                latest.close
            );

            console.log("");

            console.log(
                "Premarket High :",
                premarket.high
            );

            console.log(
                "Premarket Low  :",
                premarket.low
            );

            console.log(
                "Midpoint       :",
                premarket.midpoint
            );

            console.log(
                "Range          :",
                premarket.range
            );

            console.log(
                "Bias           :",
                premarket.bias
            );

            console.log(
                "Above High     :",
                premarket.aboveHigh
            );

            console.log(
                "Below Low      :",
                premarket.belowLow
            );

            console.log(
                "Inside Range   :",
                premarket.insideRange
            );

            console.log(
                "Volume         :",
                premarket.volume
            );

            console.log(
                "========================================"
            );

        }

        console.log("");

        //--------------------------------------------------
        // Scan
        //--------------------------------------------------

        const results: ScanResult[] = [];

        for (const history of histories) {

            for (const playbook of this.playbooks) {

                const result =
                    playbook.evaluate(
                        history.candles
                    );

                const validation =
                    playbook.validate(
                        history.candles,
                        result
                    );

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

            }

        }

        return results;

    }

}