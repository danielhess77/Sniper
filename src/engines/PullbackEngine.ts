/**
 * Sniper
 * Pullback Engine
 *
 * Version: 3.0
 *
 * Evaluates the quality of a pullback
 * during an established trend.
 *
 * Owns its own Decision Trace.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";
import {
    DecisionStep
} from "../types/DecisionTrace.js";
import {
    DecisionTraceEngine
} from "./DecisionTraceEngine.js";

export interface PullbackResult {

    level:
        | "EMA9"
        | "EMA20"
        | "NONE";

    candleIndex: number;

    pullbackCandle: Candle | null;

}

export class PullbackEngine {

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(
        candles: Candle[],
        trend: TrendResult
    ): PullbackResult {

        const none = this.none();

        //--------------------------------------------------
        // Basic Requirements
        //--------------------------------------------------

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
                ...recent.map(
                    c => c.high
                )
            );

        const lowestLow =
            Math.min(
                ...recent.map(
                    c => c.low
                )
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

       //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: PullbackResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Pullback",

            result.level !== "NONE",

            result.level,

            result.level === "NONE"

                ? "No valid pullback"

                : `Pullback to ${result.level}`

        );

        this.traceEngine.addInfo(

            "Signal Candle",

            result.candleIndex >= 0
                ? `${result.candleIndex}`
                : "None",

            result.pullbackCandle

                ? `Close ${result.pullbackCandle.close.toFixed(2)}`

                : "No pullback candle"

        );

        return this.traceEngine
            .build()
            .steps;

    }

    //--------------------------------------------------
    // Empty Result
    //--------------------------------------------------

    private none(): PullbackResult {

        return {

            level: "NONE",

            candleIndex: -1,

            pullbackCandle: null

        };

    }

}