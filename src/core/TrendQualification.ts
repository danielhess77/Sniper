/**
 * Sniper
 * Trend Qualification Engine
 *
 * Version: 0.5
 *
 * Trend + EMA + VWAP
 *
 * Never throws.
 * If insufficient candles exist, returns
 * a neutral trend instead.
 */

import { Candle } from "./BDKClient.js";
import {
    DecisionStep
} from "../types/DecisionTrace.js";

import {
    DecisionTraceEngine
} from "../engines/DecisionTraceEngine.js";

export type TrendDirection =
    | "BULLISH"
    | "BEARISH"
    | "NONE";

export interface TrendChecks {

    // Bullish
    priceAboveVWAP: boolean;
    priceAboveEMA9: boolean;
    ema9AboveEMA20: boolean;
    ema20AboveEMA50: boolean;

    // Bearish
    priceBelowVWAP: boolean;
    priceBelowEMA9: boolean;
    ema9BelowEMA20: boolean;
    ema20BelowEMA50: boolean;

}

export interface TrendResult {

    direction: TrendDirection;

    currentPrice: number;

    latestCandle: Candle;

    ema9: number;
    ema20: number;
    ema50: number;

    vwap: number;

    checks: TrendChecks;

}

export class TrendQualification {

private traceEngine =
    new DecisionTraceEngine();

    evaluate(
        candles: Candle[]
    ): TrendResult {

        //--------------------------------------------------
        // No candles
        //--------------------------------------------------

        if (candles.length === 0) {

            return {

                direction: "NONE",

                currentPrice: 0,

                latestCandle: {

                    open: 0,
                    high: 0,
                    low: 0,
                    close: 0,
                    volume: 0,
                    datetime: 0

                },

                ema9: 0,
                ema20: 0,
                ema50: 0,

                vwap: 0,

                checks: {

                    priceAboveVWAP: false,
                    priceAboveEMA9: false,
                    ema9AboveEMA20: false,
                    ema20AboveEMA50: false,

                    priceBelowVWAP: false,
                    priceBelowEMA9: false,
                    ema9BelowEMA20: false,
                    ema20BelowEMA50: false

                }

            };

        }

        //--------------------------------------------------
        // Not enough history yet
        //--------------------------------------------------

        if (candles.length < 50) {

            const latest =
                candles[candles.length - 1];

            return {

                direction: "NONE",

                currentPrice:
                    latest.close,

                latestCandle:
                    latest,

                ema9: 0,
                ema20: 0,
                ema50: 0,

                vwap: 0,

                checks: {

                    priceAboveVWAP: false,
                    priceAboveEMA9: false,
                    ema9AboveEMA20: false,
                    ema20AboveEMA50: false,

                    priceBelowVWAP: false,
                    priceBelowEMA9: false,
                    ema9BelowEMA20: false,
                    ema20BelowEMA50: false

                }

            };

        }

        //--------------------------------------------------
        // Normal Calculation
        //--------------------------------------------------

        const closes =
            candles.map(c => c.close);

        const ema9 =
            this.calculateEMA(closes, 9);

        const ema20 =
            this.calculateEMA(closes, 20);

        const ema50 =
            this.calculateEMA(closes, 50);

        const vwap =
            this.calculateVWAP(candles);

        const latestCandle =
            candles[candles.length - 1];

        const currentPrice =
            latestCandle.close;

        const checks: TrendChecks = {

            // Bullish

            priceAboveVWAP:
                currentPrice > vwap,

            priceAboveEMA9:
                currentPrice > ema9,

            ema9AboveEMA20:
                ema9 > ema20,

            ema20AboveEMA50:
                ema20 > ema50,

            // Bearish

            priceBelowVWAP:
                currentPrice < vwap,

            priceBelowEMA9:
                currentPrice < ema9,

            ema9BelowEMA20:
                ema9 < ema20,

            ema20BelowEMA50:
                ema20 < ema50

        };

        let direction: TrendDirection =
            "NONE";

        if (

            checks.priceAboveVWAP &&
            checks.priceAboveEMA9 &&
            checks.ema9AboveEMA20 &&
            checks.ema20AboveEMA50

        ) {

            direction = "BULLISH";

        }
        else if (

            checks.priceBelowVWAP &&
            checks.priceBelowEMA9 &&
            checks.ema9BelowEMA20 &&
            checks.ema20BelowEMA50

        ) {

            direction = "BEARISH";

        }

        return {

            direction,

            currentPrice,

            latestCandle,

            ema9,

            ema20,

            ema50,

            vwap,

            checks

        };

    }

    trace(
    result: TrendResult
): DecisionStep[] {

    this.traceEngine.reset();

    this.traceEngine.add(

        "Trend",

        result.direction !== "NONE",

        result.direction,

        result.direction === "NONE"

            ? "EMA stack not aligned"

            : `EMA9 ${result.ema9} | EMA20 ${result.ema20} | EMA50 ${result.ema50}`

    );

    this.traceEngine.add(

    "VWAP",

    true,

    `${result.vwap.toFixed(2)}`,

    result.checks.priceAboveVWAP

        ? "Price above VWAP"

        : result.checks.priceBelowVWAP

            ? "Price below VWAP"

            : "Price at VWAP"

);

    return this.traceEngine
        .build()
        .steps;

}

    private calculateEMA(
        values: number[],
        period: number
    ): number {

        const k =
            2 / (period + 1);

        let ema =
            values[0];

        for (let i = 1; i < values.length; i++) {

            ema =
                values[i] * k +
                ema * (1 - k);

        }

        return Number(
            ema.toFixed(2)
        );

    }

    private calculateVWAP(
        candles: Candle[]
    ): number {

        let cumulativePV = 0;

        let cumulativeVolume = 0;

        for (const candle of candles) {

            const typicalPrice =

                (
                    candle.high +
                    candle.low +
                    candle.close
                ) / 3;

            cumulativePV +=

                typicalPrice *
                candle.volume;

            cumulativeVolume +=
                candle.volume;

        }

        return Number(

            (
                cumulativePV /
                cumulativeVolume
            ).toFixed(2)

        );

    }

}