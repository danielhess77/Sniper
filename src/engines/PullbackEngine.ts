/**
 * PullbackEngine v1.0
 *
 * Purpose:
 * Detect a valid trend continuation pullback.
 *
 * Returns:
 *   EMA9
 *   EMA20
 *   NONE
 */

import { TrendResult } from "../core/TrendQualification.js";

export type PullbackLevel =
    | "EMA9"
    | "EMA20"
    | "NONE";

export interface PullbackResult {
    level: PullbackLevel;
}

export class PullbackEngine {

    evaluate(
        candles: any[],
        trend: TrendResult
    ): PullbackResult {

        if (trend.direction === "NONE") {
            return { level: "NONE" };
        }

        if (candles.length < 20) {
            return { level: "NONE" };
        }

        //--------------------------------------------------
        // Recent price action
        //--------------------------------------------------

        const recent = candles.slice(-20);

        const highs = recent.map(c => c.high);
        const lows = recent.map(c => c.low);

        const highestHigh = Math.max(...highs);
        const lowestLow = Math.min(...lows);

        const last = recent[recent.length - 1];

        //--------------------------------------------------
        // Bullish Trend
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            // Was there an impulse?
            if (highestHigh <= trend.ema9) {
                return { level: "NONE" };
            }

            // Trend broken
            if (last.close < trend.ema20) {
                return { level: "NONE" };
            }

            // Pullback to EMA9
            if (
                last.low <= trend.ema9 &&
                last.close >= trend.ema9
            ) {
                return {
                    level: "EMA9"
                };
            }

            // Pullback to EMA20
            if (
                last.low <= trend.ema20 &&
                last.close >= trend.ema20
            ) {
                return {
                    level: "EMA20"
                };
            }

            return {
                level: "NONE"
            };
        }

        //--------------------------------------------------
        // Bearish Trend
        //--------------------------------------------------

        if (trend.direction === "BEARISH") {

            // Was there an impulse?
            if (lowestLow >= trend.ema9) {
                return { level: "NONE" };
            }

            // Trend broken
            if (last.close > trend.ema20) {
                return { level: "NONE" };
            }

            // Pullback to EMA9
            if (
                last.high >= trend.ema9 &&
                last.close <= trend.ema9
            ) {
                return {
                    level: "EMA9"
                };
            }

            // Pullback to EMA20
            if (
                last.high >= trend.ema20 &&
                last.close <= trend.ema20
            ) {
                return {
                    level: "EMA20"
                };
            }

            return {
                level: "NONE"
            };
        }

        return {
            level: "NONE"
        };
    }

}