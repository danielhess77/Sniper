/**
 * PullbackEngine v2.0
 *
 * Evaluates the quality of a pullback
 * during an established trend.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";

export interface PullbackResult {

    level:
        | "EMA9"
        | "EMA20"
        | "NONE";

}

export class PullbackEngine {

    evaluate(
        candles: Candle[],
        trend: TrendResult
    ): PullbackResult {

        if (
            candles.length < 10 ||
            trend.direction === "NONE"
        ) {

            return {
                level: "NONE"
            };

        }

        const last = candles[candles.length - 1];

        //--------------------------------------------------
        // Recent Momentum
        //--------------------------------------------------

        const recent = candles.slice(-6);

        const highestHigh =
            Math.max(...recent.map(c => c.high));

        const lowestLow =
            Math.min(...recent.map(c => c.low));

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            // Must have recently expanded higher

            if (highestHigh <= trend.ema9) {

                return {
                    level: "NONE"
                };

            }

            // Reject overextended pullbacks

            if (last.close < trend.ema20) {

                return {
                    level: "NONE"
                };

            }

            // Preferred: touch 9 EMA

            if (
                last.low <= trend.ema9 &&
                last.close >= trend.ema9
            ) {

                return {
                    level: "EMA9"
                };

            }

            // Secondary: touch 20 EMA

            if (
                last.low <= trend.ema20 &&
                last.close >= trend.ema20
            ) {

                return {
                    level: "EMA20"
                };

            }

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        if (trend.direction === "BEARISH") {

            if (lowestLow >= trend.ema9) {

                return {
                    level: "NONE"
                };

            }

            if (last.close > trend.ema20) {

                return {
                    level: "NONE"
                };

            }

            if (
                last.high >= trend.ema9 &&
                last.close <= trend.ema9
            ) {

                return {
                    level: "EMA9"
                };

            }

            if (
                last.high >= trend.ema20 &&
                last.close <= trend.ema20
            ) {

                return {
                    level: "EMA20"
                };

            }

        }

        //--------------------------------------------------

        return {

            level: "NONE"

        };

    }

}