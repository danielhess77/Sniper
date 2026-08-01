/**
 * Sniper
 * Scanner
 *
 * Version: 1.4
 */

import { BDKClient } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";
import { ScanCard } from "../types.js";
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

        const histories = await Promise.all(

            symbols.map(async symbol => ({

                symbol,

                candles:
                    await this.bdk.getHistory(symbol)

            }))

        );

        //--------------------------------------------------
        // Temporary live-data verification
        //--------------------------------------------------

        for (const history of histories) {

            const latestCandle =
                history.candles[
                    history.candles.length - 1
                ];

            if (!latestCandle) {

                console.log(
                    `${history.symbol} | No candle data`
                );

                continue;

            }

            const candleTime =
                new Date(
                    latestCandle.datetime
                ).toLocaleString(
                    "en-US",
                    {
                        timeZone:
                            "America/New_York"
                    }
                );

            console.log(
                `${history.symbol} | ` +
                `${candleTime} | ` +
                `${latestCandle.close}`
            );

        }

        console.log("");

        //--------------------------------------------------
        // Run Playbooks
        //--------------------------------------------------

        const results: ScanResult[] = [];

        for (const history of histories) {

            for (const playbook of this.playbooks) {

                const result =
                    playbook.evaluate(
                        history.candles
                    );

                const normalized =
                    normalizeScan(
                        history.symbol,
                        result
                    );

                results.push(
                    normalized
                );

            }

        }

        return results;

    }

}