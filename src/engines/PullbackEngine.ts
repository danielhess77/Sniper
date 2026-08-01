/**
 * PullbackEngine v2.2
 *
 * Evaluates the quality of a pullback
 * during an established trend.
 *
 * Returns the pullback candle and its index
 * so downstream playbooks can evaluate
 * context-aware confirmation.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";

export interface PullbackResult {

    level:
        | "EMA9"
        | "EMA20"
        | "NONE";

    candleIndex: number;

    pullbackCandle: Candle | null;

}

export class PullbackEngine {

    evaluate(
        candles: Candle[],
        trend: TrendResult
    ): PullbackResult {

        const none: PullbackResult = {

            level: "NONE",

            candleIndex: -1,

            pullbackCandle: null

        };

        if (

            candles.length < 10 ||

            trend.direction === "NONE"

        ) {

            return none;

        }

        const lastIndex =
            candles.length - 1;

        const last =
            candles[lastIndex];

        //--------------------------------------------------
        // Recent Momentum
        //--------------------------------------------------

        const recent =
            candles.slice(-6);

        const highestHigh =
            Math.max(
                ...recent.map(c => c.high)
            );

        const lowestLow =
            Math.min(
                ...recent.map(c => c.low)
            );

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            if (highestHigh <= trend.ema9) {

                return none;

            }

            if (last.close < trend.ema20) {

                return none;

            }

            if (last.close < trend.ema50) {

                return none;

            }

            if (

                last.low <= trend.ema9 &&

                last.close >= trend.ema9

            ) {

                return {

                    level: "EMA9",

                    candleIndex: lastIndex,

                    pullbackCandle: last

                };

            }

            if (

                last.low <= trend.ema20 &&

                last.close >= trend.ema20

            ) {

                return {

                    level: "EMA20",

                    candleIndex: lastIndex,

                    pullbackCandle: last

                };

            }

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        if (trend.direction === "BEARISH") {

            if (lowestLow >= trend.ema9) {

                return none;

            }

            if (last.close > trend.ema20) {

                return none;

            }

            if (last.close > trend.ema50) {

                return none;

            }

            if (

                last.high >= trend.ema9 &&

                last.close <= trend.ema9

            ) {

                return {

                    level: "EMA9",

                    candleIndex: lastIndex,

                    pullbackCandle: last

                };

            }

            if (

                last.high >= trend.ema20 &&

                last.close <= trend.ema20

            ) {

                return {

                    level: "EMA20",

                    candleIndex: lastIndex,

                    pullbackCandle: last

                };

            }

        }

        return none;

    }

}