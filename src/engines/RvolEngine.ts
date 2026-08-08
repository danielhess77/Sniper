/**
 * Sniper
 * Relative Volume Engine
 *
 * Version: 2.0
 *
 * Two modes:
 *
 * 1) Opening RVOL (true early-session) — once after 10:00 ET
 *    RVOL = volume[9:30–10:00 today] / avg volume[9:30–10:00] prior sessions
 *    Uses multi-day 5-min bars. Result is frozen for the day.
 *
 * 2) Live day RVOL — every 30 minutes
 *    RVOL = totalVolume / avg10DaysVolume (quotes batch)
 */

import { BDKClient, Candle, QuoteSnapshot } from "../core/BDKClient.js";

export interface RvolCard {

    symbol: string;

    rvol: number;

    totalVolume: number;

    avg10DaysVolume: number;

    lastPrice: number;

    netPercentChange: number;

    /** opening = true first-30 RVOL; day = cumulative day formula */
    mode: "opening" | "day";

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

    /** Live day-RVOL cache (quotes) */
    private static readonly LIVE_CACHE_MS = 30 * 60_000;

    private static readonly TOP_N = 10;

    /** Prior sessions used for OR average */
    private static readonly OR_LOOKBACK_DAYS = 10;

    private liveCache:
        | {
            expiresAt: number;
            fetchedAt: string;
            live: RvolCard[];
        }
        | null = null;

    private opening30Snapshot: {
        dateKey: string;
        cards: RvolCard[];
        builtAt: string;
    } | null = null;

    private openingInFlight: Promise<RvolCard[]> | null = null;

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

        // Build true opening RVOL once per day after 10:00 ET
        if (

            afterOpen30 &&
            (
                !this.opening30Snapshot ||
                this.opening30Snapshot.dateKey !== dateKey
            )

        ) {

            if (!this.openingInFlight) {

                this.openingInFlight =
                    this.buildOpeningRvol(symbols)
                        .finally(() => {

                            this.openingInFlight = null;

                        });

            }

            try {

                const cards =
                    await this.openingInFlight;

                this.opening30Snapshot = {

                    dateKey,

                    cards,

                    builtAt: new Date().toISOString()

                };

            } catch (err) {

                console.error("Opening RVOL build failed", err);

            }

        }

        const opening30 =
            this.opening30Snapshot?.dateKey === dateKey

                ? this.opening30Snapshot.cards

                : null;

        // Live day RVOL from quotes (30-min cache)
        if (

            this.liveCache &&
            this.liveCache.expiresAt > Date.now()

        ) {

            return {

                success: true,

                timestamp: this.liveCache.fetchedAt,

                sessionMinute,

                afterOpen30,

                cached: true,

                live: this.liveCache.live,

                opening30

            };

        }

        const quotes =
            await this.bdk.getQuotes(symbols);

        const live =
            this.rankDayRvol(quotes);

        const fetchedAt =
            now.toISOString();

        this.liveCache = {

            expiresAt:
                Date.now() + RvolEngine.LIVE_CACHE_MS,

            fetchedAt,

            live

        };

        return {

            success: true,

            timestamp: fetchedAt,

            sessionMinute,

            afterOpen30,

            cached: false,

            live,

            opening30

        };

    }

    //--------------------------------------------------
    // True opening-range RVOL
    //--------------------------------------------------

    private async buildOpeningRvol(

        symbols: string[]

    ): Promise<RvolCard[]> {

        console.log("");
        console.log("=== Building true Opening RVOL (9:30–10:00) ===");

        const todayKey =
            this.getEasternDateKey(new Date());

        const cards: RvolCard[] = [];

        const batchSize = 3;

        for (let i = 0; i < symbols.length; i += batchSize) {

            const batch =
                symbols.slice(i, i + batchSize);

            const results =
                await Promise.all(

                    batch.map(async symbol => {

                        try {

                            const candles =
                                await this.bdk.getMinuteHistory(

                                    symbol,

                                    RvolEngine.OR_LOOKBACK_DAYS,

                                    "5"

                                );

                            return this.openingCardFromMinutes(

                                symbol,

                                candles,

                                todayKey

                            );

                        } catch (err) {

                            console.error(

                                `Opening RVOL failed: ${symbol}`,

                                err

                            );

                            return null;

                        }

                    })

                );

            for (const card of results) {

                if (card) {

                    cards.push(card);

                }

            }

        }

        cards.sort((a, b) => b.rvol - a.rvol);

        console.log(

            `Opening RVOL ranked ${cards.length} symbols`

        );

        return cards.slice(0, RvolEngine.TOP_N);

    }

    private openingCardFromMinutes(

        symbol: string,

        candles: Candle[],

        todayKey: string

    ): RvolCard | null {

        // dateKey -> volume in 9:30–10:00 ET
        const orByDay =
            new Map<string, number>();

        for (const c of candles) {

            if (!c.volume || c.volume <= 0) {

                continue;

            }

            const parts =
                this.easternParts(c.datetime);

            if (!parts) {

                continue;

            }

            const { dateKey, minutesFromMidnight } = parts;

            // Regular session open window: 9:30 (570) inclusive → 10:00 (600) exclusive
            if (

                minutesFromMidnight < 570 ||
                minutesFromMidnight >= 600

            ) {

                continue;

            }

            orByDay.set(

                dateKey,

                (orByDay.get(dateKey) ?? 0) + c.volume

            );

        }

        const todayOr =
            orByDay.get(todayKey) ?? 0;

        const prior: number[] = [];

        for (const [day, vol] of orByDay) {

            if (day === todayKey) {

                continue;

            }

            if (vol > 0) {

                prior.push(vol);

            }

        }

        if (todayOr <= 0 || prior.length < 3) {

            return null;

        }

        const avgOr =
            prior.reduce((a, b) => a + b, 0) / prior.length;

        if (avgOr <= 0) {

            return null;

        }

        return {

            symbol,

            rvol: todayOr / avgOr,

            totalVolume: todayOr,

            avg10DaysVolume: avgOr,

            lastPrice: 0,

            netPercentChange: 0,

            mode: "opening"

        };

    }

    //--------------------------------------------------
    // Live day RVOL (quotes)
    //--------------------------------------------------

    private rankDayRvol(

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

                netPercentChange: q.netPercentChange,

                mode: "day"

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

    //--------------------------------------------------
    // Time helpers (America/New_York)
    //--------------------------------------------------

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

        // Handle 24:00 edge from some engines
        const h = hours === 24 ? 0 : hours;

        return (h * 60 + minutes) - 570;

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

    private easternParts(

        datetimeMs: number

    ): { dateKey: string; minutesFromMidnight: number } | null {

        const date = new Date(datetimeMs);

        if (Number.isNaN(date.getTime())) {

            return null;

        }

        const parts =
            new Intl.DateTimeFormat(

                "en-US",

                {

                    timeZone: "America/New_York",

                    year: "numeric",

                    month: "2-digit",

                    day: "2-digit",

                    hour: "2-digit",

                    minute: "2-digit",

                    hour12: false

                }

            ).formatToParts(date);

        const year =
            parts.find(p => p.type === "year")?.value;

        const month =
            parts.find(p => p.type === "month")?.value;

        const day =
            parts.find(p => p.type === "day")?.value;

        let hours = Number(

            parts.find(p => p.type === "hour")?.value

        );

        const minutes = Number(

            parts.find(p => p.type === "minute")?.value

        );

        if (hours === 24) {

            hours = 0;

        }

        if (!year || !month || !day) {

            return null;

        }

        return {

            dateKey: `${year}-${month}-${day}`,

            minutesFromMidnight: hours * 60 + minutes

        };

    }

}
