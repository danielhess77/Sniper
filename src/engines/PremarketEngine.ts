/**
 * Sniper
 * Premarket Engine
 *
 * Version: 2.1
 *
 * Premarket session:
 * 4:00 AM through 9:29 AM America/New_York.
 */

import type { Candle } from "../core/BDKClient.js";

export type PremarketBias =
    | "BULLISH"
    | "BEARISH"
    | "BALANCED"
    | "NONE";

export interface PremarketResult {

    exists: boolean;

    high: number;

    low: number;

    midpoint: number;

    range: number;

    volume: number;

    currentPrice: number;

    bias: PremarketBias;

    aboveHigh: boolean;

    belowLow: boolean;

    insideRange: boolean;

    firstCandle?: Candle;

    lastCandle?: Candle;

}

export class PremarketEngine {

    private readonly easternTimeFormatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone: "America/New_York",

                year: "numeric",

                month: "2-digit",

                day: "2-digit",

                hour: "2-digit",

                minute: "2-digit",

                hourCycle: "h23"
            }
        );

    evaluate(
        candles: Candle[]
    ): PremarketResult {

        if (candles.length === 0) {

            return this.emptyResult();

        }

        const latestCandle =
            candles[candles.length - 1];

        const latestEasternDate =
            this.getEasternDateKey(
                latestCandle.datetime
            );

        //--------------------------------------------------
        // Current day's premarket:
        // 4:00 AM through 9:29 AM Eastern
        //--------------------------------------------------

        const premarket =
            candles.filter(candle => {

                const parts =
                    this.getEasternParts(
                        candle.datetime
                    );

                const candleDate =
                    `${parts.year}-${parts.month}-${parts.day}`;

                const totalMinutes =
                    parts.hour * 60 +
                    parts.minute;

                return (

                    candleDate === latestEasternDate &&

                    totalMinutes >= 4 * 60 &&

                    totalMinutes < 9 * 60 + 30

                );

            });

        if (premarket.length === 0) {

            return this.emptyResult();

        }

        const high =
            Math.max(
                ...premarket.map(
                    candle => candle.high
                )
            );

        const low =
            Math.min(
                ...premarket.map(
                    candle => candle.low
                )
            );

        const midpoint =
            (high + low) / 2;

        const range =
            high - low;

        const volume =
            premarket.reduce(
                (sum, candle) =>
                    sum + candle.volume,
                0
            );

        const currentPrice =
            latestCandle.close;

        let bias: PremarketBias =
            "BALANCED";

        if (currentPrice > midpoint) {

            bias = "BULLISH";

        } else if (currentPrice < midpoint) {

            bias = "BEARISH";

        }

                return {

            exists: true,

            high:
                Number(high.toFixed(2)),

            low:
                Number(low.toFixed(2)),

            midpoint:
                Number(midpoint.toFixed(2)),

            range:
                Number(range.toFixed(2)),

            volume,

            currentPrice:
                Number(currentPrice.toFixed(2)),

            bias,

            aboveHigh:
                currentPrice > high,

            belowLow:
                currentPrice < low,

            insideRange:
                currentPrice >= low &&
                currentPrice <= high,

            firstCandle:
                premarket[0],

            lastCandle:
                premarket[
                    premarket.length - 1
                ]

        };

    }

    private getEasternDateKey(
        timestamp: number
    ): string {

        const parts =
            this.getEasternParts(timestamp);

        return (
            `${parts.year}-` +
            `${parts.month}-` +
            `${parts.day}`
        );

    }

    private getEasternParts(
        timestamp: number
    ): {

        year: string;

        month: string;

        day: string;

        hour: number;

        minute: number;

    } {

        const parts =
            this.easternTimeFormatter
                .formatToParts(
                    new Date(timestamp)
                );

        const values =
            Object.fromEntries(
                parts.map(
                    part => [
                        part.type,
                        part.value
                    ]
                )
            );

        return {

            year:
                values.year,

            month:
                values.month,

            day:
                values.day,

            hour:
                Number(values.hour),

            minute:
                Number(values.minute)

        };

    }

    private emptyResult(): PremarketResult {

        return {

            exists: false,

            high: 0,

            low: 0,

            midpoint: 0,

            range: 0,

            volume: 0,

            currentPrice: 0,

            bias: "NONE",

            aboveHigh: false,

            belowLow: false,

            insideRange: false

        };

    }

}