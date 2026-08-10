/**
 * Sniper
 * Failed Opening Range Engine
 *
 * Version: 1.1
 *
 * 30-minute OR (9:30–10:00 ET). No fail signals until range is complete.
 * 1) Full OR forms
 * 2) Close beyond high/low after 10:00
 * 3) Reclaim back inside → fade
 */

import { Candle } from "../core/BDKClient.js";
import {
    MarketSession,
    OPENING_RANGE_MINUTES
} from "../utils/MarketSession.js";
import { DecisionStep } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "./DecisionTraceEngine.js";

export interface FailedOpeningRangeResult {

    /** Direction of the TRADE (fade), not the original breakout */
    direction: "BULLISH" | "BEARISH" | "NONE";

    breakoutSide: "BULLISH" | "BEARISH" | "NONE";

    high: number;

    low: number;

    breakoutIndex: number;

    failIndex: number;

    failPrice: number;

    excursionExtreme: number;

    reason: string;

    rangeMinutes: number;

    complete: boolean;

}

export class FailedOpeningRangeEngine {

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(

        candles: Candle[]

    ): FailedOpeningRangeResult {

        const openingRange =
            MarketSession.getOpeningRange(
                candles,
                OPENING_RANGE_MINUTES
            );

        if (openingRange.candles.length === 0) {

            return this.none("No opening range", false);

        }

        if (!openingRange.complete) {

            return this.none(

                `Waiting for full ${OPENING_RANGE_MINUTES}-min OR (through 10:00 ET)`,

                false

            );

        }

        const { high, low } =
            openingRange;

        if (high <= low) {

            return this.none("Invalid range", true);

        }

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

            return this.none("No post-OR bars yet", true);

        }

        let breakoutIndex = -1;

        let breakoutSide: "BULLISH" | "BEARISH" | "NONE" =
            "NONE";

        for (let i = postOrStart; i < candles.length; i++) {

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

                reason: "No breakout yet after 30-min OR",

                rangeMinutes: OPENING_RANGE_MINUTES,

                complete: true

            };

        }

        let excursionExtreme =
            breakoutSide === "BULLISH"

                ? candles[breakoutIndex].high

                : candles[breakoutIndex].low;

        for (let i = breakoutIndex; i < candles.length; i++) {

            const c = candles[i];

            if (breakoutSide === "BULLISH") {

                excursionExtreme =
                    Math.max(excursionExtreme, c.high);

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
                            "Bullish 30-min OR breakout failed — reclaimed inside",

                        rangeMinutes: OPENING_RANGE_MINUTES,

                        complete: true

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
                            "Bearish 30-min OR breakout failed — reclaimed inside",

                        rangeMinutes: OPENING_RANGE_MINUTES,

                        complete: true

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

            reason: "Breakout still holding outside 30-min OR",

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete: true

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

            result.high > 0

                ? `${result.low.toFixed(2)} → ${result.high.toFixed(2)}`

                : "—",

            `${OPENING_RANGE_MINUTES}-min OR (9:30–10:00 ET)`

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

        reason: string,

        complete: boolean

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

            reason,

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete

        };

    }

}
