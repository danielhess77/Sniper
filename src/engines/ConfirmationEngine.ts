/**
 * ConfirmationEngine v1.3
 *
 * Detects candlestick confirmation patterns.
 *
 * Strong reversal patterns (Engulfing, Morning Star,
 * Evening Star, Hammer, Shooting Star) may confirm
 * a trade.
 *
 * Informational patterns (Doji, Spinning Top) never
 * confirm a trade by themselves, but may add
 * confidence when combined with another playbook.
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

export type ConfirmationQuality =
    | "HIGH"
    | "MEDIUM"
    | "INFO"
    | "NONE";

export interface ConfirmationResult {

    confirmed: boolean;

    pattern: ConfirmationPattern;

    quality: ConfirmationQuality;

    candleIndex: number;

    score: number;

}

export class ConfirmationEngine {

    evaluate(candles: Candle[]): ConfirmationResult {

        if (candles.length < 3) {

            return {

                confirmed: false,

                pattern: "NONE",

                quality: "NONE",

                candleIndex: -1,

                score: 0

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

                quality: "HIGH",

                candleIndex: lastIndex,

                score: 20

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

                quality: "HIGH",

                candleIndex: lastIndex,

                score: 20

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

                quality: "MEDIUM",

                candleIndex: lastIndex,

                score: 16

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

                quality: "MEDIUM",

                candleIndex: lastIndex,

                score: 16

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

                quality: "HIGH",

                candleIndex: lastIndex,

                score: 18

            };

        }

        //------------------------------------------
        // Evening Star
        //------------------------------------------

        if (

            c1.close > c1.open &&
            Math.abs(c2.close - c2.open) <
                Math.abs(c1.close - c1.open) * 0.40 &&
            c3.close <
                (c1.open + c1.close) / 2 &&
            c3.close < c3.open

        ) {

            return {

                confirmed: true,

                pattern: "EVENING_STAR",

                quality: "HIGH",

                candleIndex: lastIndex,

                score: 18

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

                quality: "INFO",

                candleIndex: lastIndex,

                score: 10

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

                quality: "INFO",

                candleIndex: lastIndex,

                score: 8

            };

        }

        //------------------------------------------
        // None
        //------------------------------------------

        return {

            confirmed: false,

            pattern: "NONE",

            quality: "NONE",

            candleIndex: -1,

            score: 0

        };

    }

}