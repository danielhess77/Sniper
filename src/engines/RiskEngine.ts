/**
 * RiskEngine v2.1
 *
 * Calculates:
 * - Entry
 * - Stop
 * - Target
 * - Risk / Reward
 *
 * Stops and targets are derived from
 * recent market structure instead of
 * a fixed 2R projection.
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
        confirmation: ConfirmationResult,
        entryOverride?: number
    ): RiskResult {

        //--------------------------------------------------
        // Validation
        //--------------------------------------------------

        if (

            candles.length < 20 ||
            trend.direction === "NONE" ||
            !confirmation.confirmed ||
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

        const signal = candles[confirmation.candleIndex];

        const entry =
            entryOverride ?? signal.close;

        //--------------------------------------------------
        // Recent Structure
        //--------------------------------------------------

        const stopWindow = candles.slice(
            Math.max(0, confirmation.candleIndex - 4),
            confirmation.candleIndex + 1
        );

        const targetWindow = candles.slice(
            Math.max(0, confirmation.candleIndex - 19),
            confirmation.candleIndex + 1
        );

        let stop = 0;
        let target = 0;
        let riskReward = 0;

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            const recentLow =
                Math.min(...stopWindow.map(c => c.low));

            stop = Math.min(signal.low, recentLow);

            const recentHigh =
                Math.max(...targetWindow.map(c => c.high));

            target = recentHigh;

            const risk = entry - stop;
            const reward = target - entry;

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

            riskReward = reward / risk;

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        else {

            const recentHigh =
                Math.max(...stopWindow.map(c => c.high));

            stop = Math.max(signal.high, recentHigh);

            const recentLow =
                Math.min(...targetWindow.map(c => c.low));

            target = recentLow;

            const risk = stop - entry;
            const reward = entry - target;

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

            riskReward = reward / risk;

        }

        //--------------------------------------------------
        // Final Result
        //--------------------------------------------------

        return {

            valid: riskReward >= 2,

            entry,

            stop,

            target,

            riskReward

        };

    }

}