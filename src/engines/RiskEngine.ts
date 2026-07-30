/**
 * RiskEngine v1.1
 *
 * Calculates:
 * - Entry
 * - Stop
 * - Target
 * - Risk / Reward
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
        // Validation
        //--------------------------------------------------

        if (
            candles.length === 0 ||
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

        //--------------------------------------------------
        // Confirmation Candle
        //--------------------------------------------------

        const signal = candles[confirmation.candleIndex];

        const entry = signal.close;

        let stop = 0;

        let target = 0;

        let riskReward = 0;

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            stop = signal.low;

            const risk = entry - stop;

            if (risk <= 0) {

                return {

                    valid: false,

                    entry,

                    stop,

                    target: 0,

                    riskReward: 0

                };

            }

            target = entry + (risk * 2);

            riskReward = (target - entry) / risk;

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        else {

            stop = signal.high;

            const risk = stop - entry;

            if (risk <= 0) {

                return {

                    valid: false,

                    entry,

                    stop,

                    target: 0,

                    riskReward: 0

                };

            }

            target = entry - (risk * 2);

            riskReward = (entry - target) / risk;

        }

        //--------------------------------------------------
        // Result
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