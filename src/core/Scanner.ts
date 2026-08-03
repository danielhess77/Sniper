/**
 * Sniper
 * Scanner
 *
 * Version: 2.0
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

        const histories = await Promise.all(

            symbols.map(async symbol => ({

                symbol,

                candles: await this.bdk.getHistory(symbol)

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

            console.log(

                `${history.symbol} | ` +

                `${new Date(latest.datetime).toLocaleString(
                    "en-US",
                    {
                        timeZone:
                            "America/New_York"
                    }
                )} | ` +

                latest.close

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