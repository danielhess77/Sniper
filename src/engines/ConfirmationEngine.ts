/**
 * ConfirmationEngine v1.1
 *
 * Determines whether the most recent candles
 * provide a valid trend continuation trigger.
 */

import { Candle } from "../core/BDKClient.js";

export type ConfirmationPattern =
    | "BULLISH_ENGULFING"
    | "BEARISH_ENGULFING"
    | "HAMMER"
    | "SHOOTING_STAR"
    | "MORNING_STAR"
    | "EVENING_STAR"
    | "DOJI"
    | "SPINNING_TOP"
    | "NONE";

export interface ConfirmationResult {

    confirmed: boolean;

    pattern: ConfirmationPattern;

    candleIndex: number;

}

export class ConfirmationEngine {

    evaluate(candles: Candle[]): ConfirmationResult {

        if (candles.length < 3) {

            return {

                confirmed: false,

                pattern: "NONE",

                candleIndex: -1

            };

        }

        const lastIndex = candles.length - 1;

        const c1 = candles[lastIndex - 2];
        const c2 = candles[lastIndex - 1];
        const c3 = candles[lastIndex];

        //------------------------------------------
        // Bullish Engulfing
        //------------------------------------------

        if (

            c2.close < c2.open &&
            c3.close > c3.open &&
            c3.open <= c2.close &&
            c3.close >= c2.open

        ) {

            return {

                confirmed: true,

                pattern: "BULLISH_ENGULFING",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Bearish Engulfing
        //------------------------------------------

        if (

            c2.close > c2.open &&
            c3.close < c3.open &&
            c3.open >= c2.close &&
            c3.close <= c2.open

        ) {

            return {

                confirmed: true,

                pattern: "BEARISH_ENGULFING",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Shared Candle Measurements
        //------------------------------------------

        const body = Math.abs(c3.close - c3.open);

        const upperShadow =
            c3.high - Math.max(c3.open, c3.close);

        const lowerShadow =
            Math.min(c3.open, c3.close) - c3.low;

        const range =
            c3.high - c3.low;

        //------------------------------------------
        // Hammer
        //------------------------------------------

        if (

            range > 0 &&
            lowerShadow >= body * 2 &&
            upperShadow <= body

        ) {

            return {

                confirmed: true,

                pattern: "HAMMER",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Shooting Star
        //------------------------------------------

        if (

            range > 0 &&
            upperShadow >= body * 2 &&
            lowerShadow <= body

        ) {

            return {

                confirmed: true,

                pattern: "SHOOTING_STAR",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Morning Star
        //------------------------------------------

        if (

            c1.close < c1.open &&
            Math.abs(c2.close - c2.open) <
                Math.abs(c1.close - c1.open) * 0.40 &&
            c3.close > c3.open &&
            c3.close >
                (c1.open + c1.close) / 2

        ) {

            return {

                confirmed: true,

                pattern: "MORNING_STAR",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Evening Star
        //------------------------------------------

        if (

            c1.close > c1.open &&
            Math.abs(c2.close - c2.open) <
                Math.abs(c1.close - c1.open) * 0.40 &&
            c3.close < c3.open &&
            c3.close <
                (c1.open + c1.close) / 2

        ) {

            return {

                confirmed: true,

                pattern: "EVENING_STAR",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Doji
        //------------------------------------------

        if (

            range > 0 &&
            body <= range * 0.10

        ) {

            return {

                confirmed: false,

                pattern: "DOJI",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // Spinning Top
        //------------------------------------------

        if (

            range > 0 &&
            body <= range * 0.30 &&
            upperShadow > body &&
            lowerShadow > body

        ) {

            return {

                confirmed: false,

                pattern: "SPINNING_TOP",

                candleIndex: lastIndex

            };

        }

        //------------------------------------------
        // None
        //------------------------------------------

        return {

            confirmed: false,

            pattern: "NONE",

            candleIndex: -1

        };

    }

}