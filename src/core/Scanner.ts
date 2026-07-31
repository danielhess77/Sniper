/**
 * Sniper
 * Scanner
 *
 * Version: 1.0
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
    symbol: string
): Promise<ScanResult[]> {

    const candles =
        await this.bdk.getHistory(symbol);

    const results: ScanResult[] = [];

    for (const playbook of this.playbooks) {

        const result =
            playbook.evaluate(candles) as any;

        if (!result.qualified) {
            continue;
        }

        results.push({

            symbol,

            playbook: result.playbook,

            qualified: true,

            result

        });

    }

    return results;

}

}