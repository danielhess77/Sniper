/**
 * Sniper
 * Swing Pullback Engine
 *
 * Version: 1.0
 *
 * Detects a bullish impulse, a pullback into the rising 20 EMA
 * (or prior swing demand), and a reclaim trigger on daily bars.
 *
 * v1 uses daily structure for both horizons (rate-limit friendly).
 * Intraday trigger refinement can layer on later for Short.
 */

import { Candle } from "../core/BDKClient.js";

export interface SwingPullbackResult {

    /** Pullback structure exists */
    hasPullback: boolean;

    /** Reclaim trigger has fired */
    triggered: boolean;

    pullbackLow: number;

    pullbackHigh: number;

    impulseHigh: number;

    impulseLow: number;

    /** Height of impulse leg for measured move */
    impulseSize: number;

    /** Index of trigger bar in daily candles (-1 if none) */
    triggerIndex: number;

    /** Suggested entry = trigger close */
    entry: number;

    reason: string;

}

export class SwingPullbackEngine {

    evaluate(

        dailyCandles: Candle[],

        ema20: number

    ): SwingPullbackResult {

        const empty = (

            reason: string

        ): SwingPullbackResult => ({

            hasPullback: false,

            triggered: false,

            pullbackLow: 0,

            pullbackHigh: 0,

            impulseHigh: 0,

            impulseLow: 0,

            impulseSize: 0,

            triggerIndex: -1,

            entry: 0,

            reason

        });

        if (dailyCandles.length < 30) {

            return empty("Insufficient daily bars");

        }

        const n = dailyCandles.length;

        //--------------------------------------------------
        // Find recent impulse: swing low → swing high
        // over the last ~25 bars
        //--------------------------------------------------

        const windowStart =
            Math.max(0, n - 25);

        const window =
            dailyCandles.slice(windowStart);

        let impulseLowIdx = 0;

        let impulseHighIdx = 0;

        for (let i = 0; i < window.length; i++) {

            if (window[i].low <= window[impulseLowIdx].low) {

                impulseLowIdx = i;

            }

        }

        // High after the low
        impulseHighIdx = impulseLowIdx;

        for (let i = impulseLowIdx; i < window.length; i++) {

            if (window[i].high >= window[impulseHighIdx].high) {

                impulseHighIdx = i;

            }

        }

        if (impulseHighIdx <= impulseLowIdx) {

            return empty("No clear impulse leg");

        }

        const impulseLow =
            window[impulseLowIdx].low;

        const impulseHigh =
            window[impulseHighIdx].high;

        const impulseSize =
            impulseHigh - impulseLow;

        if (impulseSize <= 0) {

            return empty("Zero impulse size");

        }

        // Absolute indices
        const absHighIdx =
            windowStart + impulseHighIdx;

        //--------------------------------------------------
        // Pullback after impulse high: lows drift toward EMA20
        //--------------------------------------------------

        if (absHighIdx >= n - 1) {

            return empty("Impulse high is the latest bar — no pullback yet");

        }

        const afterImpulse =
            dailyCandles.slice(absHighIdx + 1);

        if (afterImpulse.length < 1) {

            return empty("No bars after impulse");

        }

        let pullbackLow =
            afterImpulse[0].low;

        let pullbackHigh =
            afterImpulse[0].high;

        for (const c of afterImpulse) {

            pullbackLow =
                Math.min(pullbackLow, c.low);

            pullbackHigh =
                Math.max(pullbackHigh, c.high);

        }

        // Must have actually pulled back (not still making highs only)
        const pulledBack =
            pullbackLow < impulseHigh * 0.995;

        if (!pulledBack) {

            return empty("No meaningful pullback after impulse");

        }

        // Prefer pullbacks that tagged / approached 20 EMA
        const taggedEma =
            pullbackLow <= ema20 * 1.02;

        if (!taggedEma) {

            return {

                hasPullback: false,

                triggered: false,

                pullbackLow,

                pullbackHigh,

                impulseHigh,

                impulseLow,

                impulseSize,

                triggerIndex: -1,

                entry: 0,

                reason: "Pullback did not approach 20 EMA"

            };

        }

        // Must not destroy structure: pullback low still above impulse low
        if (pullbackLow < impulseLow) {

            return empty("Pullback broke impulse low — trend damaged");

        }

        //--------------------------------------------------
        // Trigger: latest bar reclaims above the pullback
        // pivot (close > max high of pullback bars except itself
        // if still forming, or close back above EMA after tag)
        //--------------------------------------------------

        const last =
            dailyCandles[n - 1];

        // Pullback range excluding the last bar if last is the reclaim
        const pullbackOnly =
            afterImpulse.length > 1

                ? afterImpulse.slice(0, -1)

                : afterImpulse;

        const pivotHigh =
            pullbackOnly.length

                ? Math.max(...pullbackOnly.map(c => c.high))

                : afterImpulse[0].high;

        const reclaimed =
            last.close > pivotHigh ||
            (last.close > ema20 && pullbackLow <= ema20 * 1.01);

        if (!reclaimed) {

            return {

                hasPullback: true,

                triggered: false,

                pullbackLow,

                pullbackHigh: pivotHigh,

                impulseHigh,

                impulseLow,

                impulseSize,

                triggerIndex: -1,

                entry: 0,

                reason: "Pullback active — waiting for reclaim trigger"

            };

        }

        return {

            hasPullback: true,

            triggered: true,

            pullbackLow,

            pullbackHigh: pivotHigh,

            impulseHigh,

            impulseLow,

            impulseSize,

            triggerIndex: n - 1,

            entry: last.close,

            reason: "Pullback reclaim triggered"

        };

    }

}
