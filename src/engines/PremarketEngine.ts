/**
 * Sniper
 * Premarket Engine
 *
 * Version: 1.0
 */

import { Candle } from "../core/BDKClient.js";

export interface PremarketResult {

    exists: boolean;

    high: number;

    low: number;

    midpoint: number;

    range: number;

    volume: number;

    firstCandle?: Candle;

    lastCandle?: Candle;

}

export class PremarketEngine {

    evaluate(
        candles: Candle[]
    ): PremarketResult {

        const premarket = candles.filter(candle => {

            const date = new Date(candle.datetime);

            const hour =
                date.getHours();

            const minute =
                date.getMinutes();

            const totalMinutes =
                hour * 60 + minute;

            // 4:00 AM – 9:29 AM Eastern

            return (

                totalMinutes >= 240 &&

                totalMinutes < 570

            );

        });

        if (premarket.length === 0) {

            return {

                exists: false,

                high: 0,

                low: 0,

                midpoint: 0,

                range: 0,

                volume: 0

            };

        }

        const high = Math.max(

            ...premarket.map(

                candle => candle.high

            )

        );

        const low = Math.min(

            ...premarket.map(

                candle => candle.low

            )

        );

        const volume = premarket.reduce(

            (sum, candle) =>

                sum + candle.volume,

            0

        );

        return {

            exists: true,

            high,

            low,

            midpoint:
                (high + low) / 2,

            range:
                high - low,

            volume,

            firstCandle:
                premarket[0],

            lastCandle:
                premarket[premarket.length - 1]

        };

    }

}