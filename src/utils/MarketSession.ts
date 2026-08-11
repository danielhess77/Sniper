/**
 * MarketSession
 *
 * Opening Range locked at 30 minutes (9:30–10:00 ET).
 * If clock-today has no bars (stale history ending yesterday),
 * fall back to the most recent ET day present in the series.
 */

import { Candle } from "../core/BDKClient.js";
import { etCalendarDay } from "../core/SessionDay.js";

export const OPENING_RANGE_MINUTES = 30;

export interface OpeningRange {
    high: number;
    low: number;
    candles: Candle[];
    complete: boolean;
    /** ET calendar day used for this OR */
    dayEt: string;
}

export class MarketSession {

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

    static getRegularSession(
        candles: Candle[]
    ): Candle[] {

        return candles.filter(c =>
            this.isRegularSession(c)
        );
    }

    static getSessionDay(
        candles: Candle[],
        dayEt: string
    ): Candle[] {

        return candles.filter(c => {

            const ms = Number(c.datetime);

            if (!Number.isFinite(ms)) return false;

            return etCalendarDay(ms) === dayEt;

        });

    }

    /**
     * Prefer clock today; if no bars that day (API lag / prior close only),
     * use the latest ET calendar day that appears in the series.
     */
    static resolveSessionDay(
        candles: Candle[],
        preferredDay: string = etCalendarDay()
    ): string {

        const preferred = this.getSessionDay(candles, preferredDay);

        if (preferred.length > 0) {

            return preferredDay;

        }

        let bestDay = preferredDay;

        let bestMs = -1;

        for (const c of candles) {

            const ms = Number(c.datetime);

            if (!Number.isFinite(ms) || ms <= bestMs) continue;

            bestMs = ms;

            bestDay = etCalendarDay(ms);

        }

        return bestDay;

    }

    static getTodayRegularSession(
        candles: Candle[],
        dayEt?: string
    ): Candle[] {

        const day =
            dayEt ?? this.resolveSessionDay(candles);

        return this.getSessionDay(candles, day).filter(c =>
            this.isRegularSession(c)
        );

    }

    static getOpeningRange(
        candles: Candle[],
        openingMinutes = OPENING_RANGE_MINUTES,
        dayEt?: string
    ): OpeningRange {

        const day =
            dayEt ?? this.resolveSessionDay(candles);

        const session =
            this.getTodayRegularSession(candles, day);

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
                complete: false,
                dayEt: day
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
            complete,
            dayEt: day
        };

    }

}
