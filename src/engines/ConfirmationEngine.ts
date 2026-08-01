/**
 * ConfirmationEngine v2.0
 *
 * Searches for confirmation beginning at the
 * supplied signal candle and continuing for
 * the next three candles.
 *
 * The strongest confirmation found wins.
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

    confirmationOffset: number;

    score: number;

}

export class ConfirmationEngine {

    private static readonly LOOKAHEAD = 3;

    evaluate(

        candles: Candle[],

        signalIndex: number

    ): ConfirmationResult {

        if (

            candles.length < 3 ||

            signalIndex < 2 ||

            signalIndex >= candles.length

        ) {

            return this.none();

        }

        let best =
            this.none();

        const end = Math.min(

            candles.length - 1,

            signalIndex +
            ConfirmationEngine.LOOKAHEAD

        );

        for (

            let i = signalIndex;

            i <= end;

            i++

        ) {

            const result =
                this.evaluateAt(
                    candles,
                    i
                );

            if (

                result.score >
                best.score

            ) {

                result.confirmationOffset =
                    i - signalIndex;

                best = result;

            }

        }

        return best;

    }

    //--------------------------------------------------
    // Evaluate Single Candle Position
    //--------------------------------------------------

    private evaluateAt(

        candles: Candle[],

        index: number

    ): ConfirmationResult {

        if (index < 2) {

            return this.none();

        }

        const c1 =
            candles[index - 2];

        const c2 =
            candles[index - 1];

        const c3 =
            candles[index];

        //--------------------------------------------------
        // Bullish Engulfing
        //--------------------------------------------------

        if (

            c2.close < c2.open &&
            c3.close > c3.open &&
            c3.open <= c2.close &&
            c3.close >= c2.open

        ) {

            return {

                confirmed: true,

                pattern:
                    "BULLISH_ENGULFING",

                quality: "HIGH",

                candleIndex: index,

                confirmationOffset: 0,

                score: 20

            };

        }

        //--------------------------------------------------
        // Bearish Engulfing
        //--------------------------------------------------

        if (

            c2.close > c2.open &&
            c3.close < c3.open &&
            c3.open >= c2.close &&
            c3.close <= c2.open

        ) {

            return {

                confirmed: true,

                pattern:
                    "BEARISH_ENGULFING",

                quality: "HIGH",

                candleIndex: index,

                confirmationOffset: 0,

                score: 20

            };

        }

        const body =
            Math.abs(
                c3.close -
                c3.open
            );

        const upperShadow =
            c3.high -
            Math.max(
                c3.open,
                c3.close
            );

        const lowerShadow =
            Math.min(
                c3.open,
                c3.close
            ) -
            c3.low;

        const range =
            c3.high -
            c3.low;

        //--------------------------------------------------
        // Hammer
        //--------------------------------------------------

        if (

            range > 0 &&
            lowerShadow >= body * 2 &&
            upperShadow <= body

        ) {

            return {

                confirmed: true,

                pattern: "HAMMER",

                quality: "MEDIUM",

                candleIndex: index,

                confirmationOffset: 0,

                score: 16

            };

        }

        //--------------------------------------------------
        // Shooting Star
        //--------------------------------------------------

        if (

            range > 0 &&
            upperShadow >= body * 2 &&
            lowerShadow <= body

        ) {

            return {

                confirmed: true,

                pattern:
                    "SHOOTING_STAR",

                quality: "MEDIUM",

                candleIndex: index,

                confirmationOffset: 0,

                score: 16

            };

        }

        //--------------------------------------------------
        // Morning Star
        //--------------------------------------------------

        if (

            c1.close < c1.open &&
            Math.abs(
                c2.close -
                c2.open
            ) <
            Math.abs(
                c1.close -
                c1.open
            ) * 0.40 &&
            c3.close > c3.open &&
            c3.close >
            (c1.open + c1.close) / 2

        ) {

            return {

                confirmed: true,

                pattern:
                    "MORNING_STAR",

                quality: "HIGH",

                candleIndex: index,

                confirmationOffset: 0,

                score: 18

            };

        }

        //--------------------------------------------------
        // Evening Star
        //--------------------------------------------------

        if (

            c1.close > c1.open &&
            Math.abs(
                c2.close -
                c2.open
            ) <
            Math.abs(
                c1.close -
                c1.open
            ) * 0.40 &&
            c3.close <
            (c1.open + c1.close) / 2 &&
            c3.close < c3.open

        ) {

            return {

                confirmed: true,

                pattern:
                    "EVENING_STAR",

                quality: "HIGH",

                candleIndex: index,

                confirmationOffset: 0,

                score: 18

            };

        }

        //--------------------------------------------------
        // Doji
        //--------------------------------------------------

        if (

            range > 0 &&
            body <=
            range * 0.10

        ) {

            return {

                confirmed: false,

                pattern: "DOJI",

                quality: "INFO",

                candleIndex: index,

                confirmationOffset: 0,

                score: 10

            };

        }

        //--------------------------------------------------
        // Spinning Top
        //--------------------------------------------------

        if (

            range > 0 &&
            body <=
            range * 0.30 &&
            upperShadow > body &&
            lowerShadow > body

        ) {

            return {

                confirmed: false,

                pattern:
                    "SPINNING_TOP",

                quality: "INFO",

                candleIndex: index,

                confirmationOffset: 0,

                score: 8

            };

        }

        return this.none();

    }

    //--------------------------------------------------

    private none(): ConfirmationResult {

        return {

            confirmed: false,

            pattern: "NONE",

            quality: "NONE",

            candleIndex: -1,

            confirmationOffset: -1,

            score: 0

        };

    }

}