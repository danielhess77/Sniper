/**
 * Sniper
 * Opening Range Breakout Playbook
 *
 * Version: 2.0
 */

import { Candle } from "../core/BDKClient.js";
import { OpeningRangeEngine } from "../engines/OpeningRangeEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { Playbook } from "./Playbook.js";

export interface ValidationResult {

    active: boolean;

    reason: string;

}

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
            this.confirmation.evaluate(
                candles,
                openingRange.breakoutIndex
            );

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

            const target =

                openingRange.direction === "BULLISH"

                    ? Math.max(
                        ...breakoutCandles.map(
                            c => c.high
                        )
                    )

                    : Math.min(
                        ...breakoutCandles.map(
                            c => c.low
                        )
                    );

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

            playbook: 25,

            confirmation:
                confirmation.score,

            risk:
                this.score.evaluateRisk(
                    trade.riskReward
                ),

            entry:
                this.score.evaluateEntry(

                    candles.length - 1 -
                    confirmation.candleIndex

                )

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

    validate(

        candles: Candle[],

        result: OpeningRangeBreakoutResult

    ): ValidationResult {

        if (!result.qualified) {

            return {

                active: false,

                reason: "Not Qualified"

            };

        }

        const last =
            candles[candles.length - 1];

        //--------------------------------------------------
        // Bullish ORB
        //--------------------------------------------------

        if (

            result.openingRange.direction === "BULLISH"

        ) {

            if (

                last.close < result.openingRange.high

            ) {

                return {

                    active: false,

                    reason:
                        "Returned Inside Opening Range"

                };

            }

        }

        //--------------------------------------------------
        // Bearish ORB
        //--------------------------------------------------

        if (

            result.openingRange.direction === "BEARISH"

        ) {

            if (

                last.close > result.openingRange.low

            ) {

                return {

                    active: false,

                    reason:
                        "Returned Inside Opening Range"

                };

            }

        }

        //--------------------------------------------------
        // Signal still valid
        //--------------------------------------------------

        return {

            active: true,

            reason: ""

        };

    }

}