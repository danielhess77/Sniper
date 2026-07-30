/**
 * MarketSession
 *
 * Utility functions for working with
 * market sessions.
 */

import { Candle } from "../core/BDKClient.js";

export interface OpeningRange {
    high: number;
    low: number;
    candles: Candle[];
}

export class MarketSession {

    /**
     * Returns the market minute
     * since 9:30 AM Eastern.
     *
     * 9:30 = 0
     * 9:31 = 1
     * ...
     * 10:00 = 30
     */
    static getSessionMinute(
        candle: Candle
    ): number {

        const easternTime = new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone: "America/New_York",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }
        );

        const parts = easternTime.formatToParts(
            new Date(candle.datetime)
        );

        const hours = Number(
            parts.find(p => p.type === "hour")?.value
        );

        const minutes = Number(
            parts.find(p => p.type === "minute")?.value
        );

        return (hours * 60 + minutes) - 570;
    }

    /**
     * True during the regular market session.
     */
    static isRegularSession(
        candle: Candle
    ): boolean {

        const minute =
            this.getSessionMinute(candle);

        return minute >= 0 && minute < 390;
    }

    /**
     * True if candle belongs to
     * the opening range.
     */
    static isOpeningRange(
        candle: Candle,
        openingMinutes = 30
    ): boolean {

        const minute =
            this.getSessionMinute(candle);

        return (
            minute >= 0 &&
            minute < openingMinutes
        );
    }

    /**
     * Returns only regular-session candles.
     */
    static getRegularSession(
        candles: Candle[]
    ): Candle[] {

        return candles.filter(c =>
            this.isRegularSession(c)
        );
    }

    /**
     * Returns the opening range.
     */
    static getOpeningRange(
        candles: Candle[],
        openingMinutes = 30
    ): OpeningRange {

        const session =
            this.getRegularSession(candles);

        const rangeCandles =
            session.filter(c =>
                this.isOpeningRange(
                    c,
                    openingMinutes
                )
            );

        if (rangeCandles.length === 0) {

            return {
                high: 0,
                low: 0,
                candles: []
            };

        }

        const high = Math.max(
            ...rangeCandles.map(c => c.high)
        );

        const low = Math.min(
            ...rangeCandles.map(c => c.low)
        );

        return {
            high,
            low,
            candles: rangeCandles
        };
    }

}