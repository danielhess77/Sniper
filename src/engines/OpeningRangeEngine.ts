/**
 * Sniper
 * Opening Range Engine
 *
 * Version: 3.0 — ORB lean stack
 *
 * 30-min OR (9:30–10:00 ET).
 * Breakout search only 10:00–11:00 ET.
 * Require close outside OR + next bar hold outside.
 * Skip flat opens (min OR height).
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

/** Session minutes: 10:00 ET = 30, 11:00 ET = 90 */
const ORB_WINDOW_START = OPENING_RANGE_MINUTES; // 30
const ORB_WINDOW_END = 90; // 11:00 ET

/** Min OR height: 0.20% of mid or $0.15, whichever larger */
const MIN_OR_PCT = 0.002;
const MIN_OR_DOLLARS = 0.15;

export interface OpeningRangeResult {

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    high: number;

    low: number;

    /** Index of the hold bar (entry signal), or -1 */
    breakoutIndex: number;

    breakoutPrice: number;

    breakoutCandle: Candle | null;

    /** Index of first close outside OR (before hold) */
    probeIndex: number;

    rangeMinutes: number;

    complete: boolean;

    orHeight: number;

    /** Why direction is NONE when OR is complete */
    rejectReason: string;

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
                openingRange.complete,
                !openingRange.complete
                    ? `Waiting for full ${OPENING_RANGE_MINUTES}-min OR (through 10:00 ET)`
                    : "No OR candles"
            );

        }

        const {

            high,

            low

        } = openingRange;

        const orHeight = high - low;

        const mid = (high + low) / 2;

        const minHeight =
            Math.max(mid * MIN_OR_PCT, MIN_OR_DOLLARS);

        if (orHeight < minHeight) {

            return {

                direction: "NONE",

                high,

                low,

                breakoutIndex: -1,

                breakoutPrice: 0,

                breakoutCandle: null,

                probeIndex: -1,

                rangeMinutes: OPENING_RANGE_MINUTES,

                complete: true,

                orHeight,

                rejectReason:
                    `OR too tight (${orHeight.toFixed(2)} < min ${minHeight.toFixed(2)})`

            };

        }

        // First RTH bar at or after 10:00 ET
        let postOrStart = -1;

        for (let i = 0; i < candles.length; i++) {

            if (
                MarketSession.isRegularSession(candles[i]) &&
                MarketSession.getSessionMinute(candles[i]) >= ORB_WINDOW_START
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

                probeIndex: -1,

                rangeMinutes: OPENING_RANGE_MINUTES,

                complete: true,

                orHeight,

                rejectReason: "No post-OR bars yet"

            };

        }

        // Search 10:00–11:00 ET only: close outside + hold bar outside
        for (

            let i = postOrStart;

            i < candles.length - 1;

            i++

        ) {

            const probe = candles[i];

            const hold = candles[i + 1];

            if (!MarketSession.isRegularSession(probe)) continue;

            if (!MarketSession.isRegularSession(hold)) continue;

            const probeMin =
                MarketSession.getSessionMinute(probe);

            const holdMin =
                MarketSession.getSessionMinute(hold);

            // Both bars must sit in the ORB window (10:00–11:00)
            if (probeMin < ORB_WINDOW_START || probeMin >= ORB_WINDOW_END) {

                continue;

            }

            if (holdMin < ORB_WINDOW_START || holdMin >= ORB_WINDOW_END) {

                continue;

            }

            // Bullish: probe closes above OR high, hold still closes above
            if (
                probe.close > high &&
                hold.close > high
            ) {

                return {

                    direction: "BULLISH",

                    high,

                    low,

                    breakoutIndex: i + 1,

                    breakoutPrice: hold.close,

                    breakoutCandle: hold,

                    probeIndex: i,

                    rangeMinutes: OPENING_RANGE_MINUTES,

                    complete: true,

                    orHeight,

                    rejectReason: ""

                };

            }

            // Bearish: probe closes below OR low, hold still closes below
            if (
                probe.close < low &&
                hold.close < low
            ) {

                return {

                    direction: "BEARISH",

                    high,

                    low,

                    breakoutIndex: i + 1,

                    breakoutPrice: hold.close,

                    breakoutCandle: hold,

                    probeIndex: i,

                    rangeMinutes: OPENING_RANGE_MINUTES,

                    complete: true,

                    orHeight,

                    rejectReason: ""

                };

            }

        }

        // Past 11:00 with no valid hold → dead for the day on ORB
        const lastRth = [...candles].reverse().find(c =>
            MarketSession.isRegularSession(c)
        );

        const lastMin = lastRth
            ? MarketSession.getSessionMinute(lastRth)
            : -1;

        const rejectReason =
            lastMin >= ORB_WINDOW_END

                ? "No held breakout in 10:00–11:00 ET window"

                : "Waiting for close+hold outside OR (10:00–11:00 ET)";

        return {

            direction: "NONE",

            high,

            low,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null,

            probeIndex: -1,

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete: true,

            orHeight,

            rejectReason

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

                    ? (result.rejectReason || "No ORB signal")

                    : `${result.direction} held breakout of 30-min OR`

        );

        this.traceEngine.addInfo(

            "Range",

            result.high > 0

                ? `${result.low.toFixed(2)} → ${result.high.toFixed(2)} (h=${result.orHeight.toFixed(2)})`

                : "—",

            `${OPENING_RANGE_MINUTES}-min OR · window 10:00–11:00 ET · min height applied`

        );

        this.traceEngine.addInfo(

            "Breakout Candle",

            result.breakoutIndex >= 0

                ? `hold@${result.breakoutIndex}`

                : "None",

            result.breakoutCandle

                ? `Hold close ${result.breakoutCandle.close.toFixed(2)}` +
                  (result.probeIndex >= 0 ? ` · probe@${result.probeIndex}` : "")

                : (result.rejectReason || "No held breakout")

        );

        return this.traceEngine
            .build()
            .steps;

    }

    private none(

        complete = false,

        rejectReason = ""

    ): OpeningRangeResult {

        return {

            direction: "NONE",

            high: 0,

            low: 0,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null,

            probeIndex: -1,

            rangeMinutes: OPENING_RANGE_MINUTES,

            complete,

            orHeight: 0,

            rejectReason

        };

    }

}
