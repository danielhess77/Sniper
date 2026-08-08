/**
 * Sniper
 * Relative Volume Engine
 *
 * Version: 1.0
 *
 * RVOL = totalVolume / avg10DaysVolume
 *
 * Rate-limit friendly:
 * - One batch quotes call for the entire watchlist
 * - 90-second in-memory cache
 * - Captures a frozen ranking once session is >= 30 min after open
 */

import { BDKClient, QuoteSnapshot } from "../core/BDKClient.js";

export interface RvolCard {

    symbol: string;

    rvol: number;

    totalVolume: number;

    avg10DaysVolume: number;

    lastPrice: number;

    netPercentChange: number;

}

export interface RvolResult {

    success: boolean;

    timestamp: string;

    sessionMinute: number;

    afterOpen30: boolean;

    cached: boolean;

    live: RvolCard[];

    opening30: RvolCard[] | null;

}

export class RvolEngine {

    private static readonly CACHE_MS = 90_000;

    private static readonly TOP_N = 10;

    private cache:
        | {
            expiresAt: number;
            live: RvolCard[];
            sessionMinute: number;
        }
        | null = null;

    private opening30Snapshot: {
        dateKey: string;
        cards: RvolCard[];
    } | null = null;

    constructor(

        private bdk: BDKClient

    ) {}

    async evaluate(

        symbols: string[]

    ): Promise<RvolResult> {

        const now = new Date();

        const sessionMinute =
            this.getSessionMinute(now);

        const afterOpen30 =
            sessionMinute >= 30;

        const dateKey =
            this.getEasternDateKey(now);

        // Serve cache when fresh
        if (

            this.cache &&
            this.cache.expiresAt > Date.now()

        ) {

            return {

                success: true,

                timestamp: now.toISOString(),

                sessionMinute,

                afterOpen30,

                cached: true,

                live: this.cache.live,

                opening30:
                    this.opening30Snapshot?.dateKey === dateKey

                        ? this.opening30Snapshot.cards

                        : null

            };

        }

        const quotes =
            await this.bdk.getQuotes(symbols);

        const live =
            this.rank(quotes);

        this.cache = {

            expiresAt:
                Date.now() + RvolEngine.CACHE_MS,

            live,

            sessionMinute

        };

        // Freeze ranking once we are past 10:00 ET (30 min after open)
        if (

            afterOpen30 &&
            (
                !this.opening30Snapshot ||
                this.opening30Snapshot.dateKey !== dateKey
            )

        ) {

            this.opening30Snapshot = {

                dateKey,

                cards: live

            };

        }

        return {

            success: true,

            timestamp: now.toISOString(),

            sessionMinute,

            afterOpen30,

            cached: false,

            live,

            opening30:
                this.opening30Snapshot?.dateKey === dateKey

                    ? this.opening30Snapshot.cards

                    : null

        };

    }

    private rank(

        quotes: QuoteSnapshot[]

    ): RvolCard[] {

        const cards: RvolCard[] = [];

        for (const q of quotes) {

            if (

                q.avg10DaysVolume <= 0 ||
                q.totalVolume <= 0

            ) {

                continue;

            }

            cards.push({

                symbol: q.symbol,

                rvol:
                    q.totalVolume / q.avg10DaysVolume,

                totalVolume: q.totalVolume,

                avg10DaysVolume: q.avg10DaysVolume,

                lastPrice: q.lastPrice,

                netPercentChange: q.netPercentChange

            });

        }

        cards.sort(

            (a, b) => b.rvol - a.rvol

        );

        return cards.slice(

            0,

            RvolEngine.TOP_N

        );

    }

    /**
     * Minutes since 9:30 AM Eastern.
     * Negative before the open.
     */
    private getSessionMinute(

        date: Date

    ): number {

        const parts =
            new Intl.DateTimeFormat(

                "en-US",

                {

                    timeZone: "America/New_York",

                    hour: "2-digit",

                    minute: "2-digit",

                    hour12: false

                }

            ).formatToParts(date);

        const hours = Number(

            parts.find(p => p.type === "hour")?.value

        );

        const minutes = Number(

            parts.find(p => p.type === "minute")?.value

        );

        return (hours * 60 + minutes) - 570;

    }

    private getEasternDateKey(

        date: Date

    ): string {

        return new Intl.DateTimeFormat(

            "en-CA",

            {

                timeZone: "America/New_York",

                year: "numeric",

                month: "2-digit",

                day: "2-digit"

            }

        ).format(date);

    }

}
