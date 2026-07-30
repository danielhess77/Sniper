/**
 * Opening Range Breakout Engine
 *
 * Version: 1.1
 *
 * Determines whether price has broken
 * the opening range.
 */

import { Candle } from "../core/BDKClient.js";
import { MarketSession } from "../utils/MarketSession.js";

export interface OpeningRangeResult {

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    high: number;

    low: number;

    breakoutIndex: number;

    breakoutPrice: number;

    breakoutCandle: Candle | null;

}

export class OpeningRangeEngine {

    evaluate(
        candles: Candle[]
    ): OpeningRangeResult {

        const openingRange =
            MarketSession.getOpeningRange(candles);

        if (openingRange.candles.length === 0) {

            return {

                direction: "NONE",

                high: 0,

                low: 0,

                breakoutIndex: -1,

                breakoutPrice: 0,

                breakoutCandle: null

            };

        }

        const {

            high,

            low,

            candles: rangeCandles

        } = openingRange;

        const startIndex = rangeCandles.length;

        for (
            let i = startIndex;
            i < candles.length;
            i++
        ) {

            const candle = candles[i];

            if (candle.close > high) {

                return {

                    direction: "BULLISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice: candle.close,

                    breakoutCandle: candle

                };

            }

            if (candle.close < low) {

                return {

                    direction: "BEARISH",

                    high,

                    low,

                    breakoutIndex: i,

                    breakoutPrice: candle.close,

                    breakoutCandle: candle

                };

            }

        }

        return {

            direction: "NONE",

            high,

            low,

            breakoutIndex: -1,

            breakoutPrice: 0,

            breakoutCandle: null

        };

    }

}