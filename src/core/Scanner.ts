/**
 * Sniper
 * Scanner
 *
 * Version: 1.2
 */

import { BDKClient } from "./BDKClient.js";
import { Playbook } from "../playbooks/Playbook.js";

export interface ScanResult {

    symbol: string;

    playbook: string;

    qualified: boolean;

    result: unknown;

}

export class Scanner {

    constructor(

        private bdk: BDKClient,

        private playbooks: Playbook<unknown>[]

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

        const results: ScanResult[] = [];

        for (const history of histories) {

            for (const playbook of this.playbooks) {

                const result =
                    playbook.evaluate(history.candles) as any;

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