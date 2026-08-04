/**
 * Sniper
 * Opening Range Engine
 *
 * Version: 2.0
 *
 * Detects Opening Range Breakouts.
 *
 * Owns its own Decision Trace.
 */

import { Candle } from "../core/BDKClient.js";
import { MarketSession } from "../utils/MarketSession.js";
import {
    DecisionStep
} from "../types/DecisionTrace.js";
import {
    DecisionTraceEngine
} from "./DecisionTraceEngine.js";

export interface OpeningRangeResult {

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    high: number;

    low: number;

    breakoutIndex: number;

    breakoutPrice: number;

    breakoutCandle: Candle | null;

}

export class OpeningRangeEngine {

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(
        candles: Candle[]
    ): OpeningRangeResult {

        const openingRange =
            MarketSession.getOpeningRange(candles);

        if (openingRange.candles.length === 0) {

            return this.none();

        }

        const {

            high,

            low,

            candles: rangeCandles

        } = openingRange;

        const startIndex =
            rangeCandles.length;

        for (

            let i = startIndex;

            i < candles.length;

            i++

        ) {

            const candle =
                candles[i];

            //--------------------------------------------------
            // Bullish Breakout
            //--------------------------------------------------

            if (candle.close > high) {

                return {

                    direction: "BULLISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice:
                        candle.close,

                    breakoutCandle:
                        candle

                };

            }

            //--------------------------------------------------
            // Bearish Breakout
            //--------------------------------------------------

            if (candle.close < low) {

                return {

                    direction: "BEARISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice:
                        candle.close,

                    breakoutCandle:
                        candle

                };

            }

        }

        return {

            direction: "NONE",

            high,

            low,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null

        };

    }

    //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: OpeningRangeResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        //--------------------------------------------------
        // Breakout
        //--------------------------------------------------

        this.traceEngine.add(

            "Opening Range",

            result.direction !== "NONE",

            result.direction,

            result.direction === "NONE"

                ? "No breakout detected"

                : `${result.direction} breakout confirmed`

        );

        //--------------------------------------------------
        // Range
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Range",

            `${result.low.toFixed(2)} → ${result.high.toFixed(2)}`,

            "Opening Range"

        );

        //--------------------------------------------------
        // Breakout Candle
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Breakout Candle",

            result.breakoutIndex >= 0

                ? `${result.breakoutIndex}`

                : "None",

            result.breakoutCandle

                ? `Close ${result.breakoutCandle.close.toFixed(2)}`

                : "No breakout candle"

        );

        return this.traceEngine
            .build()
            .steps;

    }

    //--------------------------------------------------
    // Empty Result
    //--------------------------------------------------

    private none(): OpeningRangeResult {

        return {

            direction: "NONE",

            high: 0,

            low: 0,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null

        };

    }

}