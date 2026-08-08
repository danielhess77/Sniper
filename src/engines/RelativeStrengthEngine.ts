/**
 * Sniper
 * Relative Strength Engine
 *
 * Version: 1.0
 *
 * Ranks symbols by % change vs SPY over a lookback window.
 * Top 30% of the watchlist pass the leadership filter.
 */

import { Candle } from "../core/BDKClient.js";

export interface RsInput {

    symbol: string;

    /** Daily (or session) candles, oldest → newest */
    candles: Candle[];

}

export interface RsCard {

    symbol: string;

    rs: number;

    stockReturn: number;

    spyReturn: number;

    rank: number;

    percentile: number;

    passesTop30: boolean;

}

export class RelativeStrengthEngine {

    private static readonly TOP_FRACTION = 0.30;

    /**
     * Rank the full universe against SPY.
     * `spyCandles` must cover at least `lookback` sessions.
     */
    rank(

        universe: RsInput[],

        spyCandles: Candle[],

        lookback: number

    ): RsCard[] {

        const spyReturn =
            this.sessionReturn(spyCandles, lookback);

        if (spyReturn === null) {

            return [];

        }

        const scored: Omit<RsCard, "rank" | "percentile" | "passesTop30">[] = [];

        for (const item of universe) {

            const stockReturn =
                this.sessionReturn(item.candles, lookback);

            if (stockReturn === null) {

                continue;

            }

            scored.push({

                symbol: item.symbol,

                rs: stockReturn - spyReturn,

                stockReturn,

                spyReturn

            });

        }

        scored.sort((a, b) => b.rs - a.rs);

        const n = scored.length;

        const topCount =
            Math.max(1, Math.ceil(n * RelativeStrengthEngine.TOP_FRACTION));

        return scored.map((row, index) => {

            const rank = index + 1;

            const percentile =
                n <= 1 ? 100 : ((n - rank) / (n - 1)) * 100;

            return {

                ...row,

                rank,

                percentile,

                passesTop30: rank <= topCount

            };

        });

    }

    private sessionReturn(

        candles: Candle[],

        lookback: number

    ): number | null {

        if (candles.length < lookback + 1) {

            return null;

        }

        const end =
            candles[candles.length - 1].close;

        const start =
            candles[candles.length - 1 - lookback].close;

        if (start <= 0) {

            return null;

        }

        return (end - start) / start;

    }

}
