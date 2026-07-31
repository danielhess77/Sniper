/**
 * Sniper
 * VWAP Reclaim Engine
 *
 * Version: 1.1
 */

import { Candle } from "../core/BDKClient.js";

export interface VWAPReclaimResult {

    reclaimed: boolean;

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    candleIndex: number;

    reclaimCandle: Candle | null;

}

export class VWAPReclaimEngine {

    private static readonly LOOKBACK = 3;

    evaluate(

        candles: Candle[],

        vwap: number,

        trend: "BULLISH" | "BEARISH" | "NONE"

    ): VWAPReclaimResult {

        if (candles.length < 2) {

            return {

                reclaimed: false,

                direction: "NONE",

                candleIndex: -1,

                reclaimCandle: null

            };

        }

        const start = Math.max(

            1,

            candles.length - VWAPReclaimEngine.LOOKBACK

        );

        for (

            let i = start;

            i < candles.length;

            i++

        ) {

            const previous = candles[i - 1];

            const current = candles[i];

            //
            // Bullish Reclaim
            //

            if (

                trend === "BULLISH" &&

                previous.close < vwap &&

                current.close > vwap

            ) {

                return {

                    reclaimed: true,

                    direction: "BULLISH",

                    candleIndex: i,

                    reclaimCandle: current

                };

            }

            //
            // Bearish Reclaim
            //

            if (

                trend === "BEARISH" &&

                previous.close > vwap &&

                current.close < vwap

            ) {

                return {

                    reclaimed: true,

                    direction: "BEARISH",

                    candleIndex: i,

                    reclaimCandle: current

                };

            }

        }

        return {

            reclaimed: false,

            direction: "NONE",

            candleIndex: -1,

            reclaimCandle: null

        };

    }

}