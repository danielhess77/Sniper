/**
 * Sniper
 * Market Regime Engine
 *
 * Version: 1.0
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";

export type MarketRegime =

    | "TREND_UP"

    | "TREND_DOWN"

    | "CHOPPY"

    | "PINNED"

    | "LOW_VOLUME";

export interface MarketRegimeResult {

    regime: MarketRegime;

    confidence: number;

    reason: string;

}

export class MarketRegimeEngine {

    private trend =
        new TrendQualification();

    evaluate(
        candles: Candle[]
    ): MarketRegimeResult {

        const trend =
            this.trend.evaluate(candles);

        //--------------------------------------------------
        // Trend Up
        //--------------------------------------------------

        if (

            trend.direction === "BULLISH"

        ) {

            return {

                regime: "TREND_UP",

                confidence: 80,

                reason:
                    "Bullish EMA stack above VWAP"

            };

        }

        //--------------------------------------------------
        // Trend Down
        //--------------------------------------------------

        if (

            trend.direction === "BEARISH"

        ) {

            return {

                regime: "TREND_DOWN",

                confidence: 80,

                reason:
                    "Bearish EMA stack below VWAP"

            };

        }

        //--------------------------------------------------
        // Default
        //--------------------------------------------------

        return {

            regime: "CHOPPY",

            confidence: 50,

            reason:
                "No qualified trend"

        };

    }

}