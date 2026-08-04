/**
 * Sniper
 * VWAP Reclaim Engine
 *
 * Version: 2.0
 *
 * Detects recent VWAP reclaims.
 *
 * Owns its own Decision Trace.
 */

import { Candle } from "../core/BDKClient.js";
import {
    DecisionStep
} from "../types/DecisionTrace.js";
import {
    DecisionTraceEngine
} from "./DecisionTraceEngine.js";

export interface VWAPReclaimResult {

    reclaimed: boolean;

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    candleIndex: number;

    reclaimCandle: Candle | null;

}

export class VWAPReclaimEngine {

    private traceEngine =
        new DecisionTraceEngine();

    private static readonly LOOKBACK = 3;

    evaluate(

        candles: Candle[],

        vwap: number,

        trend: "BULLISH" | "BEARISH" | "NONE"

    ): VWAPReclaimResult {

        if (candles.length < 2) {

            return this.none();

        }

        const start = Math.max(

            1,

            candles.length -
            VWAPReclaimEngine.LOOKBACK

        );

        for (

            let i = start;

            i < candles.length;

            i++

        ) {

            const previous =
                candles[i - 1];

            const current =
                candles[i];

            //--------------------------------------------------
            // Bullish Reclaim
            //--------------------------------------------------

            if (

                trend === "BULLISH" &&

                previous.close < vwap &&

                current.close > vwap

            ) {

                return {

                    reclaimed: true,

                    direction: "BULLISH",

                    candleIndex: i,

                    reclaimCandle: current

                };

            }

            //--------------------------------------------------
            // Bearish Reclaim
            //--------------------------------------------------

            if (

                trend === "BEARISH" &&

                previous.close > vwap &&

                current.close < vwap

            ) {

                return {

                    reclaimed: true,

                    direction: "BEARISH",

                    candleIndex: i,

                    reclaimCandle: current

                };

            }

        }

        return this.none();

    }

    //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: VWAPReclaimResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        //--------------------------------------------------
        // Reclaim
        //--------------------------------------------------

        this.traceEngine.add(

            "VWAP Reclaim",

            result.reclaimed,

            result.direction,

            result.reclaimed

                ? `${result.direction} reclaim confirmed`

                : "No reclaim detected"

        );

        //--------------------------------------------------
        // Signal Candle
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Signal Candle",

            result.candleIndex >= 0

                ? `${result.candleIndex}`

                : "None",

            result.reclaimCandle

                ? `Close ${result.reclaimCandle.close.toFixed(2)}`

                : "No reclaim candle"

        );

        return this.traceEngine
            .build()
            .steps;

    }

    //--------------------------------------------------
    // Empty Result
    //--------------------------------------------------

    private none(): VWAPReclaimResult {

        return {

            reclaimed: false,

            direction: "NONE",

            candleIndex: -1,

            reclaimCandle: null

        };

    }

}