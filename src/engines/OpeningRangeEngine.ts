/**
 * Sniper
 * Opening Range Engine
 *
 * Version: 2.1
 *
 * 30-minute OR (9:30–10:00 ET). No breakout until range is complete.
 */

import { Candle } from "../core/BDKClient.js";
import {
    MarketSession,
    OPENING_RANGE_MINUTES
} from "../utils/MarketSession.js";
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

    /** Minutes used for OR (always 30 for Sniper) */
    rangeMinutes: number;

    complete: boolean;

}

export class OpeningRangeEngine {

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(
        candles: Candle[]
    ): OpeningRangeResult {

        const openingRange =
            MarketSession.getOpeningRange(
                candles,
                OPENING_RANGE_MINUTES
            );

        if (
            openingRange.candles.length === 0 ||
            !openingRange.complete
        ) {

            return this.none(
                openingRange.complete
            );

        }

        const {

            high,

            low,

            candles: rangeCandles

        } = openingRange;

        // First bar after OR window (session minute >= 30)
        const startIndex =
            rangeCandles.length;

        // Align start to first post-OR regular-session index in full array
        let postOrStart = -1;

        for (let i = 0; i < candles.length; i++) {

            if (
                MarketSession.isRegularSession(candles[i]) &&
                MarketSession.getSessionMinute(candles[i]) >= OPENING_RANGE_MINUTES
            ) {

                postOrStart = i;

                break;

            }

        }

        if (postOrStart < 0) {

            return {

                direction: "NONE",

                high,

                low,

                breakoutIndex: -1,

                breakoutPrice: 0,

                breakoutCandle: null,

                rangeMinutes: OPENING_RANGE_MINUTES,

                complete: true

            };

        }

        for (

            let i = postOrStart;

            i < candles.length;

            i++

        ) {

            const candle =
                candles[i];

            if (candle.close > high) {

                return {

                    direction: "BULLISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice:
                        candle.close,

                    breakoutCandle:
                        candle,

                    rangeMinutes: OPENING_RANGE_MINUTES,

                    complete: true

                };

            }

            if (candle.close < low) {

                return {

                    direction: "BEARISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice:
                        candle.close,

                    breakoutCandle:
                        candle,

                    rangeMinutes: OPENING_RANGE_MINUTES,

                    complete: true

                };

            }

        }

        return {

            direction: "NONE",

            high,

            low,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null,

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete: true

        };

    }

    trace(
        result: OpeningRangeResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Opening Range",

            result.direction !== "NONE",

            result.direction,

            !result.complete

                ? `Waiting for full ${OPENING_RANGE_MINUTES}-min OR (through 10:00 ET)`

                : result.direction === "NONE"

                    ? "No breakout yet after 30-min OR"

                    : `${result.direction} breakout of 30-min OR`

        );

        this.traceEngine.addInfo(

            "Range",

            result.high > 0

                ? `${result.low.toFixed(2)} → ${result.high.toFixed(2)}`

                : "—",

            `${OPENING_RANGE_MINUTES}-min OR (9:30–10:00 ET)`

        );

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

    private none(

        complete = false

    ): OpeningRangeResult {

        return {

            direction: "NONE",

            high: 0,

            low: 0,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null,

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete

        };

    }

}
