/**
 * Sniper
 * Tight Base Engine
 *
 * Version: 1.0
 *
 * Detects a compressed base (NR-style / low range vs ATR),
 * then a daily close breakout above the base high.
 *
 * Longs only in v1.
 */

import { Candle } from "../core/BDKClient.js";

export interface TightBaseResult {

    hasBase: boolean;

    triggered: boolean;

    baseHigh: number;

    baseLow: number;

    baseHeight: number;

    /** Average true range context */
    atr: number;

    /** Compression: baseHeight / atr */
    compression: number;

    /** Bars in the base window */
    baseBars: number;

    triggerIndex: number;

    entry: number;

    reason: string;

}

export class TightBaseEngine {

    /** Look for base in last N completed bars before trigger */
    private static readonly BASE_LOOKBACK = 12;

    /** Minimum bars that form the tight zone */
    private static readonly MIN_BASE_BARS = 5;

    private static readonly ATR_PERIOD = 14;

    /** Base height must be ≤ this multiple of ATR */
    private static readonly MAX_COMPRESSION = 1.35;

    /** Prefer bases tighter than this for higher score path */
    private static readonly TIGHT_COMPRESSION = 1.0;

    evaluate(

        dailyCandles: Candle[]

    ): TightBaseResult {

        const empty = (

            reason: string

        ): TightBaseResult => ({

            hasBase: false,

            triggered: false,

            baseHigh: 0,

            baseLow: 0,

            baseHeight: 0,

            atr: 0,

            compression: 0,

            baseBars: 0,

            triggerIndex: -1,

            entry: 0,

            reason

        });

        if (dailyCandles.length < 40) {

            return empty("Insufficient daily history");

        }

        const atr =
            this.atr(dailyCandles, TightBaseEngine.ATR_PERIOD);

        if (atr <= 0) {

            return empty("ATR unavailable");

        }

        const n = dailyCandles.length;

        const last =
            dailyCandles[n - 1];

        // Candidate base = bars before the latest (latest may be breakout)
        const lookback =
            TightBaseEngine.BASE_LOOKBACK;

        // Try several base windows ending at n-2 (day before last)
        let best: TightBaseResult | null = null;

        for (

            let len = TightBaseEngine.MIN_BASE_BARS;

            len <= lookback;

            len++

        ) {

            const end = n - 2; // last base bar index

            const start = end - len + 1;

            if (start < 5) continue;

            const baseSlice =
                dailyCandles.slice(start, end + 1);

            const baseHigh =
                Math.max(...baseSlice.map(c => c.high));

            const baseLow =
                Math.min(...baseSlice.map(c => c.low));

            const baseHeight =
                baseHigh - baseLow;

            if (baseHeight <= 0) continue;

            const compression =
                baseHeight / atr;

            if (compression > TightBaseEngine.MAX_COMPRESSION) {

                continue;

            }

            // Also require average bar range compressed vs ATR
            const avgBarRange =
                baseSlice.reduce((s, c) => s + (c.high - c.low), 0) /
                baseSlice.length;

            if (avgBarRange > atr * 0.95) {

                continue;

            }

            // NR-ish: latest base bar or median range is among tighter
            const ranges =
                baseSlice.map(c => c.high - c.low).sort((a, b) => a - b);

            const medianRange =
                ranges[Math.floor(ranges.length / 2)];

            if (medianRange > atr * 0.9) {

                continue;

            }

            // Breakout: last close above base high (acceptance)
            const triggered =
                last.close > baseHigh;

            // Watching: still inside / under base high
            const hasBase = true;

            const candidate: TightBaseResult = {

                hasBase,

                triggered,

                baseHigh,

                baseLow,

                baseHeight,

                atr,

                compression,

                baseBars: len,

                triggerIndex: triggered ? n - 1 : -1,

                entry: triggered ? last.close : 0,

                reason: triggered

                    ? `Tight base breakout (${len}d, ${compression.toFixed(2)}×ATR)`

                    : `Tight base forming (${len}d, ${compression.toFixed(2)}×ATR) — waiting for breakout`

            };

            // Prefer tighter compression, then longer base
            if (

                !best ||
                candidate.compression < best.compression - 0.02 ||
                (Math.abs(candidate.compression - best.compression) < 0.02 &&
                    candidate.baseBars > best.baseBars)

            ) {

                best = candidate;

            }

        }

        if (!best) {

            return empty("No compressed base found");

        }

        return best;

    }

    isTight(

        result: TightBaseResult

    ): boolean {

        return (

            result.hasBase &&
            result.compression > 0 &&
            result.compression <= TightBaseEngine.TIGHT_COMPRESSION

        );

    }

    private atr(

        candles: Candle[],

        period: number

    ): number {

        if (candles.length < period + 1) return 0;

        const trs: number[] = [];

        for (let i = 1; i < candles.length; i++) {

            const c = candles[i];

            const prev = candles[i - 1];

            trs.push(

                Math.max(

                    c.high - c.low,

                    Math.abs(c.high - prev.close),

                    Math.abs(c.low - prev.close)

                )

            );

        }

        if (trs.length < period) return 0;

        let atr =
            trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < trs.length; i++) {

            atr = (atr * (period - 1) + trs[i]) / period;

        }

        return atr;

    }

}
