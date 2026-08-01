/**
 * Sniper
 * Scanner
 *
 * Version: 1.3
 */

import { BDKClient } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";

export interface ScanResult {

    symbol: string;

    playbook: string;

    qualified: boolean;

    result: any;

}

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

    for (const history of histories) {

    const latestCandle =
        history.candles[history.candles.length - 1];

        console.log(
        history.symbol,
        new Date(latestCandle.datetime).toLocaleString(
            "en-US",
            {
                timeZone: "America/New_York"
            }
        ),
        latestCandle.close
    );

}

console.log("");

        const results: ScanResult[] = [];

        for (const history of histories) {

            for (const playbook of this.playbooks) {

                const result =
                    playbook.evaluate(history.candles);

                results.push({

                    symbol: history.symbol,

                    playbook: result.playbook,

                    qualified: result.qualified,

                    result

                });

            }

        }

        return results;

    }

}