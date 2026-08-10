/**
 * MarketSession
 *
 * Utility functions for working with market sessions.
 *
 * Opening Range is locked at 30 minutes (9:30–10:00 ET)
 * for ORB and Failed OR playbooks.
 */

import { Candle } from "../core/BDKClient.js";

/** Canonical opening-range length used by ORB + Failed OR */
export const OPENING_RANGE_MINUTES = 30;

export interface OpeningRange {
    high: number;
    low: number;
    candles: Candle[];
    /** True when the full OR window has elapsed (session minute >= 30) */
    complete: boolean;
}

export class MarketSession {

    /**
     * Market minute since 9:30 AM Eastern.
     * 9:30 = 0 … 10:00 = 30 … 16:00 = 390
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

    static isRegularSession(
        candle: Candle
    ): boolean {

        const minute =
            this.getSessionMinute(candle);

        return minute >= 0 && minute < 390;
    }

    /**
     * Candle is inside the opening-range window [0, openingMinutes).
     * Default = 30 → 9:30 through 9:59 ET inclusive.
     */
    static isOpeningRange(
        candle: Candle,
        openingMinutes = OPENING_RANGE_MINUTES
    ): boolean {

        const minute =
            this.getSessionMinute(candle);

        return (
            minute >= 0 &&
            minute < openingMinutes
        );
    }

    static getRegularSession(
        candles: Candle[]
    ): Candle[] {

        return candles.filter(c =>
            this.isRegularSession(c)
        );
    }

    /**
     * Opening range high/low.
     *
     * complete = true only when we have at least one regular-session
     * candle at or after the end of the OR window (session minute >= openingMinutes),
     * so breakout logic never fires on a partial first-15-minute stub.
     */
    static getOpeningRange(
        candles: Candle[],
        openingMinutes = OPENING_RANGE_MINUTES
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
                candles: [],
                complete: false
            };

        }

        const high = Math.max(
            ...rangeCandles.map(c => c.high)
        );

        const low = Math.min(
            ...rangeCandles.map(c => c.low)
        );

        // Full OR only after the window has closed (10:00 ET for 30-min OR)
        const complete = session.some(c =>
            this.getSessionMinute(c) >= openingMinutes
        );

        return {
            high,
            low,
            candles: rangeCandles,
            complete
        };
    }

}
