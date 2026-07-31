/**
 * Sniper
 * Opening Range Breakout Playbook
 *
 * Version: 1.3
 */

import { Candle } from "../core/BDKClient.js";
import { OpeningRangeEngine } from "../engines/OpeningRangeEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { Playbook } from "./Playbook.js";

export interface OpeningRangeBreakoutResult {

    playbook: string;

    qualified: boolean;

    openingRange:
        ReturnType<OpeningRangeEngine["evaluate"]>;

    confirmation:
        ReturnType<ConfirmationEngine["evaluate"]>;

    trade: {

        valid: boolean;

        entry: number;

        stop: number;

        target: number;

        riskReward: number;

    };

    score: number;

}

export class OpeningRangeBreakout
    implements Playbook<OpeningRangeBreakoutResult> {

    private openingRange =
        new OpeningRangeEngine();

    private confirmation =
        new ConfirmationEngine();

    private score =
        new ScoreEngine();

    evaluate(
        candles: Candle[]
    ): OpeningRangeBreakoutResult {

        const openingRange =
            this.openingRange.evaluate(candles);

        const confirmation =
            this.confirmation.evaluate(candles);

        let trade = {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

        if (

            openingRange.direction !== "NONE" &&
            openingRange.breakoutIndex >= 0 &&
            confirmation.confirmed

        ) {

            const entry =
                openingRange.breakoutPrice;

            const stop =
                openingRange.direction === "BULLISH"
                    ? openingRange.low
                    : openingRange.high;

            const breakoutCandles =
                candles.slice(
                    openingRange.breakoutIndex
                );

            let target = entry;

            if (
                openingRange.direction === "BULLISH"
            ) {

                target = Math.max(
                    ...breakoutCandles.map(
                        c => c.high
                    )
                );

            } else {

                target = Math.min(
                    ...breakoutCandles.map(
                        c => c.low
                    )
                );

            }

            const risk =
                Math.abs(entry - stop);

            const reward =
                Math.abs(target - entry);

            const riskReward =
                risk > 0
                    ? reward / risk
                    : 0;

            trade = {

                valid: riskReward >= 2,

                entry,

                stop,

                target,

                riskReward

            };

        }

        const score = this.score.evaluate({

            trend: 30,

            playbook: 23,

            confirmation: 20,

            risk:
                trade.riskReward >= 3
                    ? 15
                    : 10,

            entry:
                trade.valid
                    ? 10
                    : 0

        });

        return {

            playbook:
                "Opening Range Breakout",

            qualified:
                trade.valid,

            openingRange,

            confirmation,

            trade,

            score

        };

    }

}