/**
 * MarketSession
 *
 * Opening Range is locked at 30 minutes (9:30–10:00 ET)
 * for ORB and Failed OR playbooks.
 *
 * Multi-day minute history: always scope OR / RTH helpers to
 * the America/New_York calendar day of interest (default = today).
 */

import { Candle } from "../core/BDKClient.js";
import { etCalendarDay } from "../core/SessionDay.js";

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

    /** All RTH bars (any calendar day) — prefer getSessionDay for playbooks. */
    static getRegularSession(
        candles: Candle[]
    ): Candle[] {

        return candles.filter(c =>
            this.isRegularSession(c)
        );
    }

    /**
     * Bars on a single ET calendar day (default = today).
     * Fixes multi-day history merging Friday+Monday OR highs/lows.
     */
    static getSessionDay(
        candles: Candle[],
        dayEt: string = etCalendarDay()
    ): Candle[] {

        return candles.filter(c => {

            const ms = Number(c.datetime);

            if (!Number.isFinite(ms)) return false;

            return etCalendarDay(ms) === dayEt;

        });

    }

    static getTodayRegularSession(
        candles: Candle[],
        dayEt: string = etCalendarDay()
    ): Candle[] {

        return this.getSessionDay(candles, dayEt).filter(c =>
            this.isRegularSession(c)
        );

    }

    /**
     * Opening range high/low for one ET day only (default today).
     */
    static getOpeningRange(
        candles: Candle[],
        openingMinutes = OPENING_RANGE_MINUTES,
        dayEt: string = etCalendarDay()
    ): OpeningRange {

        const session =
            this.getTodayRegularSession(candles, dayEt);

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
