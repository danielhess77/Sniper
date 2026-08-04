/**
 * Sniper
 * Target Engine
 *
 * Version: 2.0
 *
 * Selects the first meaningful and realistically
 * reachable profit objective.
 *
 * Priority:
 * 1. Nearest qualified structural swing
 * 2. ATR 2x fallback
 *
 * Structural targets must provide at least
 * 1.25 ATR of expected reward.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";

export type TargetSource =
    | "SWING_HIGH"
    | "SWING_LOW"
    | "ATR_2X"
    | "NONE";

export interface TargetResult {

    valid: boolean;

    target: number;

    expectedReward: number;

    source: TargetSource;

}

interface TargetCandidate {

    price: number;

    reward: number;

    source:
        | "SWING_HIGH"
        | "SWING_LOW";

}

export class TargetEngine {

    private static readonly LOOKBACK = 30;

    private static readonly ATR_PERIOD = 14;

    private static readonly MINIMUM_ATR_REWARD = 1.25;

    private static readonly ATR_FALLBACK_MULTIPLE = 2;

    evaluate(

        candles: Candle[],

        trend: TrendResult,

        entry: number

    ): TargetResult {

        //--------------------------------------------------
        // Basic Validation
        //--------------------------------------------------

        if (

            candles.length <
                TargetEngine.ATR_PERIOD + 1 ||

            trend.direction === "NONE" ||

            !Number.isFinite(entry) ||

            entry <= 0

        ) {

            return this.none();

        }

        //--------------------------------------------------
        // ATR
        //--------------------------------------------------

        const atr =
            this.calculateATR(

                candles,

                TargetEngine.ATR_PERIOD

            );

        if (

            !Number.isFinite(atr) ||

            atr <= 0

        ) {

            return this.none();

        }

        //--------------------------------------------------
        // Candidate Window
        //--------------------------------------------------

        const recent =
            candles.slice(

                -Math.min(

                    TargetEngine.LOOKBACK,

                    candles.length

                )

            );

        const minimumReward =

            atr *

            TargetEngine.MINIMUM_ATR_REWARD;

        //--------------------------------------------------
        // Structural Candidates
        //--------------------------------------------------

        const candidates =

            trend.direction === "BULLISH"

                ? this.findBullishCandidates(

                    recent,

                    entry,

                    minimumReward

                )

                : this.findBearishCandidates(

                    recent,

                    entry,

                    minimumReward

                );

        //--------------------------------------------------
        // Select Nearest Qualified Structure
        //--------------------------------------------------

        if (candidates.length > 0) {

            candidates.sort(

                (a, b) =>

                    a.reward -
                    b.reward

            );

            const selected =
                candidates[0];

            return {

                valid: true,

                target:
                    this.round(selected.price),

                expectedReward:
                    this.round(selected.reward),

                source:
                    selected.source

            };

        }

        //--------------------------------------------------
        // ATR Fallback
        //--------------------------------------------------

        const fallbackReward =

            atr *

            TargetEngine.ATR_FALLBACK_MULTIPLE;

        const fallbackTarget =

            trend.direction === "BULLISH"

                ? entry + fallbackReward

                : entry - fallbackReward;

        if (

            fallbackReward <= 0 ||

            fallbackTarget <= 0

        ) {

            return this.none();

        }

        return {

            valid: true,

            target:
                this.round(fallbackTarget),

            expectedReward:
                this.round(fallbackReward),

            source:
                "ATR_2X"

        };

    }

    //--------------------------------------------------
    // Bullish Structural Targets
    //--------------------------------------------------

    private findBullishCandidates(

        candles: Candle[],

        entry: number,

        minimumReward: number

    ): TargetCandidate[] {

        const candidates:
            TargetCandidate[] = [];

        for (

            let index = 2;

            index < candles.length - 2;

            index++

        ) {

            const candle =
                candles[index];

            const isSwingHigh =

                candle.high >
                    candles[index - 1].high &&

                candle.high >
                    candles[index - 2].high &&

                candle.high >=
                    candles[index + 1].high &&

                candle.high >=
                    candles[index + 2].high;

            if (!isSwingHigh) {

                continue;

            }

            const reward =
                candle.high - entry;

            if (

                reward < minimumReward

            ) {

                continue;

            }

            candidates.push({

                price:
                    candle.high,

                reward,

                source:
                    "SWING_HIGH"

            });

        }

        return candidates;

    }

        //--------------------------------------------------
    // Bearish Structural Targets
    //--------------------------------------------------

    private findBearishCandidates(

        candles: Candle[],

        entry: number,

        minimumReward: number

    ): TargetCandidate[] {

        const candidates:
            TargetCandidate[] = [];

        for (

            let index = 2;

            index < candles.length - 2;

            index++

        ) {

            const candle =
                candles[index];

            const isSwingLow =

                candle.low <
                    candles[index - 1].low &&

                candle.low <
                    candles[index - 2].low &&

                candle.low <=
                    candles[index + 1].low &&

                candle.low <=
                    candles[index + 2].low;

            if (!isSwingLow) {

                continue;

            }

            const reward =
                entry - candle.low;

            if (

                reward < minimumReward

            ) {

                continue;

            }

            candidates.push({

                price:
                    candle.low,

                reward,

                source:
                    "SWING_LOW"

            });

        }

        return candidates;

    }

    //--------------------------------------------------
    // ATR Calculation
    //--------------------------------------------------

    private calculateATR(

        candles: Candle[],

        period: number

    ): number {

        if (candles.length < 2) {

            return 0;

        }

        const startIndex =

            Math.max(

                1,

                candles.length - period

            );

        const trueRanges:
            number[] = [];

        for (

            let index = startIndex;

            index < candles.length;

            index++

        ) {

            const current =
                candles[index];

            const previous =
                candles[index - 1];

            const trueRange =
                Math.max(

                    current.high -
                        current.low,

                    Math.abs(

                        current.high -
                        previous.close

                    ),

                    Math.abs(

                        current.low -
                        previous.close

                    )

                );

            if (

                Number.isFinite(
                    trueRange
                )

            ) {

                trueRanges.push(
                    trueRange
                );

            }

        }

        if (

            trueRanges.length === 0

        ) {

            return 0;

        }

        return (

            trueRanges.reduce(

                (sum, value) =>

                    sum + value,

                0

            ) /

            trueRanges.length

        );

    }

    //--------------------------------------------------
    // Empty Result
    //--------------------------------------------------

    private none(): TargetResult {

        return {

            valid: false,

            target: 0,

            expectedReward: 0,

            source: "NONE"

        };

    }

    //--------------------------------------------------
    // Price Formatting
    //--------------------------------------------------

    private round(
        value: number
    ): number {

        return Number(
            value.toFixed(2)
        );

    }

}