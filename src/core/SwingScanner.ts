/**
 * Sniper
 * Swing Scanner
 *
 * Version: 1.1
 *
 * Qualified setups get a horizon-aware long CALL suggestion.
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { SWING_HORIZONS } from "../config/SwingHorizons.js";
import { RelativeStrengthEngine } from "../engines/RelativeStrengthEngine.js";
import { OptionSelectEngine } from "../engines/OptionSelectEngine.js";
import { SwingPlaybook, SwingResult } from "../playbooks/SwingPlaybook.js";
import type { OptionSuggestion } from "../types.js";

export interface SwingCard {

    symbol: string;

    horizon: string;

    horizonId: string;

    state: string;

    qualified: boolean;

    score: number;

    direction: "BULLISH" | "NONE";

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

    rsRank: number;

    rs: number;

    reason: string;

    option?: OptionSuggestion | null;

}

export class SwingScanner {

    private rsEngine =
        new RelativeStrengthEngine();

    private playbook =
        new SwingPlaybook();

    private optionSelect: OptionSelectEngine;

    constructor(

        private bdk: BDKClient

    ) {

        this.optionSelect = new OptionSelectEngine(bdk);

    }

    async scan(

        symbols: string[]

    ): Promise<SwingCard[]> {

        console.log("");
        console.log("========================================");
        console.log(`Swing scan: ${symbols.length} symbols`);
        console.log("========================================");

        const spyCandles =
            await this.bdk.getDailyHistory("SPY");

        const histories: { symbol: string; candles: Candle[] }[] = [];

        const batchSize = 5;

        for (let i = 0; i < symbols.length; i += batchSize) {

            const batch =
                symbols.slice(i, i + batchSize);

            const part =
                await Promise.all(

                    batch.map(async symbol => {

                        try {

                            const candles =
                                await this.bdk.getDailyHistory(symbol);

                            return { symbol, candles };

                        } catch (err) {

                            console.error(`Daily history failed: ${symbol}`, err);

                            return { symbol, candles: [] as Candle[] };

                        }

                    })

                );

            histories.push(...part);

        }

        const cards: SwingCard[] = [];

        for (const horizon of SWING_HORIZONS) {

            const rsCards =
                this.rsEngine.rank(

                    histories.map(h => ({

                        symbol: h.symbol,

                        candles: h.candles

                    })),

                    spyCandles,

                    horizon.rsLookback

                );

            const rsBySymbol =
                new Map(

                    rsCards.map(r => [r.symbol, r])

                );

            for (const history of histories) {

                if (history.candles.length < 60) {

                    continue;

                }

                const rs =
                    rsBySymbol.get(history.symbol) ?? null;

                const result =
                    this.playbook.evaluate(

                        history.candles,

                        horizon,

                        rs

                    );

                if (

                    result.state === "invalid" &&
                    result.score < 30

                ) {

                    continue;

                }

                cards.push(

                    this.toCard(history.symbol, result)

                );

            }

        }

        // Option enrichment: qualified only (shared 45-min chain cache)
        for (const card of cards) {

            if (!card.qualified) continue;

            try {

                card.option =
                    await this.optionSelect.suggestSwing(

                        card.symbol,

                        card.horizonId

                    );

            } catch (err) {

                console.error(`Swing option failed: ${card.symbol}`, err);

                card.option = null;

            }

        }

        cards.sort((a, b) => {

            if (a.qualified !== b.qualified) {

                return a.qualified ? -1 : 1;

            }

            return b.score - a.score;

        });

        console.log(

            `Swing setups returned: ${cards.length} (qualified: ${cards.filter(c => c.qualified).length})`

        );

        return cards;

    }

    private toCard(

        symbol: string,

        result: SwingResult

    ): SwingCard {

        return {

            symbol,

            horizon: result.horizon,

            horizonId: result.horizonId,

            state: result.state,

            qualified: result.qualified,

            score: result.score,

            direction: result.trend.direction,

            entry: result.risk.entry,

            stop: result.risk.stop,

            target: result.risk.target,

            riskReward: result.risk.riskReward,

            rsRank: result.rsRank,

            rs: result.rs,

            reason: result.pullback.reason

        };

    }

}
