/**
 * Sniper
 * Failed Opening Range Engine
 *
 * Version: 1.0
 *
 * 1) Opening range forms
 * 2) Price breaks out (close beyond high/low)
 * 3) Price reclaims back inside the range
 *
 * Trade direction is OPPOSITE the breakout (fade).
 */

import { Candle } from "../core/BDKClient.js";
import { MarketSession } from "../utils/MarketSession.js";
import { DecisionStep } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "./DecisionTraceEngine.js";

export interface FailedOpeningRangeResult {

    /** Direction of the TRADE (fade), not the original breakout */
    direction: "BULLISH" | "BEARISH" | "NONE";

    /** Original breakout side that failed */
    breakoutSide: "BULLISH" | "BEARISH" | "NONE";

    high: number;

    low: number;

    breakoutIndex: number;

    failIndex: number;

    failPrice: number;

    /** Extreme beyond the range after breakout (stop anchor) */
    excursionExtreme: number;

    reason: string;

}

export class FailedOpeningRangeEngine {

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(

        candles: Candle[]

    ): FailedOpeningRangeResult {

        const openingRange =
            MarketSession.getOpeningRange(candles);

        if (openingRange.candles.length === 0) {

            return this.none("No opening range");

        }

        const { high, low, candles: rangeCandles } =
            openingRange;

        if (high <= low) {

            return this.none("Invalid range");

        }

        const startIndex =
            rangeCandles.length;

        let breakoutIndex = -1;

        let breakoutSide: "BULLISH" | "BEARISH" | "NONE" =
            "NONE";

        // First close outside the range
        for (let i = startIndex; i < candles.length; i++) {

            const c = candles[i];

            if (c.close > high) {

                breakoutIndex = i;

                breakoutSide = "BULLISH";

                break;

            }

            if (c.close < low) {

                breakoutIndex = i;

                breakoutSide = "BEARISH";

                break;

            }

        }

        if (breakoutIndex < 0 || breakoutSide === "NONE") {

            return {

                direction: "NONE",

                breakoutSide: "NONE",

                high,

                low,

                breakoutIndex: -1,

                failIndex: -1,

                failPrice: 0,

                excursionExtreme: 0,

                reason: "No breakout yet"

            };

        }

        // Track extreme after breakout, find reclaim inside
        let excursionExtreme =
            breakoutSide === "BULLISH"

                ? candles[breakoutIndex].high

                : candles[breakoutIndex].low;

        for (let i = breakoutIndex; i < candles.length; i++) {

            const c = candles[i];

            if (breakoutSide === "BULLISH") {

                excursionExtreme =
                    Math.max(excursionExtreme, c.high);

                // Fail = close back inside / at or below OR high
                if (c.close <= high && i > breakoutIndex) {

                    return {

                        direction: "BEARISH",

                        breakoutSide,

                        high,

                        low,

                        breakoutIndex,

                        failIndex: i,

                        failPrice: c.close,

                        excursionExtreme,

                        reason:
                            "Bullish OR breakout failed — reclaimed inside"

                    };

                }

            } else {

                excursionExtreme =
                    Math.min(excursionExtreme, c.low);

                if (c.close >= low && i > breakoutIndex) {

                    return {

                        direction: "BULLISH",

                        breakoutSide,

                        high,

                        low,

                        breakoutIndex,

                        failIndex: i,

                        failPrice: c.close,

                        excursionExtreme,

                        reason:
                            "Bearish OR breakout failed — reclaimed inside"

                    };

                }

            }

        }

        return {

            direction: "NONE",

            breakoutSide,

            high,

            low,

            breakoutIndex,

            failIndex: -1,

            failPrice: 0,

            excursionExtreme,

            reason: "Breakout still holding outside range"

        };

    }

    trace(

        result: FailedOpeningRangeResult

    ): DecisionStep[] {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Failed OR",

            result.direction !== "NONE",

            result.direction,

            result.reason

        );

        this.traceEngine.addInfo(

            "Range",

            `${result.low.toFixed(2)} → ${result.high.toFixed(2)}`,

            "Opening Range"

        );

        this.traceEngine.addInfo(

            "Breakout Side",

            result.breakoutSide,

            result.breakoutIndex >= 0

                ? `Index ${result.breakoutIndex}`

                : "None"

        );

        this.traceEngine.addInfo(

            "Fail Candle",

            result.failIndex >= 0

                ? `${result.failIndex}`

                : "None",

            result.failPrice

                ? `Close ${result.failPrice.toFixed(2)}`

                : "No failure yet"

        );

        this.traceEngine.addInfo(

            "Excursion Extreme",

            result.excursionExtreme

                ? result.excursionExtreme.toFixed(2)

                : "—",

            "Stop anchor beyond failed breakout"

        );

        return this.traceEngine.build().steps;

    }

    private none(

        reason: string

    ): FailedOpeningRangeResult {

        return {

            direction: "NONE",

            breakoutSide: "NONE",

            high: 0,

            low: 0,

            breakoutIndex: -1,

            failIndex: -1,

            failPrice: 0,

            excursionExtreme: 0,

            reason

        };

    }

}
