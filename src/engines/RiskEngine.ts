/**
 * RiskEngine v2.1
 *
 * Calculates:
 * - Entry
 * - Stop
 * - Target
 * - Risk / Reward
 *
 * Never rejects trades solely because
 * the Risk / Reward is below 2:1.
 *
 * Only invalid trade geometry causes
 * valid = false.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";
import { ConfirmationResult } from "./ConfirmationEngine.js";

export interface RiskResult {

    valid: boolean;

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

}

export class RiskEngine {

    evaluate(

        candles: Candle[],

        trend: TrendResult,

        confirmation: ConfirmationResult

    ): RiskResult {

        //--------------------------------------------------
        // Basic Validation
        //--------------------------------------------------

        if (

            candles.length < 20 ||

            trend.direction === "NONE" ||

            confirmation.candleIndex < 0

        ) {

            return {

                valid: false,

                entry: 0,

                stop: 0,

                target: 0,

                riskReward: 0

            };

        }

        const signal =
            candles[confirmation.candleIndex];

        const entry =
            signal.close;

        //--------------------------------------------------
        // Structure Windows
        //--------------------------------------------------

        const stopWindow =
            candles.slice(

                Math.max(
                    0,
                    confirmation.candleIndex - 4
                ),

                confirmation.candleIndex + 1

            );

        const targetWindow =
            candles.slice(

                Math.max(
                    0,
                    confirmation.candleIndex - 19
                ),

                confirmation.candleIndex + 1

            );

        let stop = 0;
        let target = 0;

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            stop = Math.min(

                signal.low,

                ...stopWindow.map(
                    c => c.low
                )

            );

            target = Math.max(

                ...targetWindow.map(
                    c => c.high
                )

            );

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        else {

            stop = Math.max(

                signal.high,

                ...stopWindow.map(
                    c => c.high
                )

            );

            target = Math.min(

                ...targetWindow.map(
                    c => c.low
                )

            );

        }

        //--------------------------------------------------
        // Geometry Validation
        //--------------------------------------------------

        let risk = 0;
        let reward = 0;

        if (trend.direction === "BULLISH") {

            risk =
                entry - stop;

            reward =
                target - entry;

        }

        else {

            risk =
                stop - entry;

            reward =
                entry - target;

        }

        if (

            risk <= 0 ||

            reward <= 0

        ) {

            return {

                valid: false,

                entry,

                stop,

                target,

                riskReward: 0

            };

        }

        //--------------------------------------------------
        // Final Result
        //--------------------------------------------------

        return {

            valid: true,

            entry,

            stop,

            target,

            riskReward:
                reward / risk

        };

    }

}