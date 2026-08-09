/**
 * Sniper
 * Swing Scanner
 *
 * Version: 1.2
 *
 * Two setup paths per horizon:
 *  - RS + Pullback (existing)
 *  - RS + Tight Base Breakout (new)
 *
 * Qualified setups get horizon-aware long CALL suggestions.
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { SWING_HORIZONS } from "../config/SwingHorizons.js";
import { RelativeStrengthEngine } from "../engines/RelativeStrengthEngine.js";
import { OptionSelectEngine } from "../engines/OptionSelectEngine.js";
import { SwingPlaybook, SwingResult } from "../playbooks/SwingPlaybook.js";
import { SwingTightBasePlaybook, SwingTightBaseResult } from "../playbooks/SwingTightBasePlaybook.js";
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

    setupType: "PULLBACK" | "TIGHT_BASE";

    option?: OptionSuggestion | null;

}

export class SwingScanner {

    private rsEngine =
        new RelativeStrengthEngine();

    private pullbackPlaybook =
        new SwingPlaybook();

    private tightBasePlaybook =
        new SwingTightBasePlaybook();

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

                // Path 1: Pullback
                const pullback =
                    this.pullbackPlaybook.evaluate(

                        history.candles,

                        horizon,

                        rs

                    );

                if (

                    !(pullback.state === "invalid" && pullback.score < 30)

                ) {

                    cards.push(

                        this.fromPullback(history.symbol, pullback)

                    );

                }

                // Path 2: Tight Base Breakout
                const tight =
                    this.tightBasePlaybook.evaluate(

                        history.candles,

                        horizon,

                        rs

                    );

                if (

                    !(tight.state === "invalid" && tight.score < 30)

                ) {

                    cards.push(

                        this.fromTightBase(history.symbol, tight)

                    );

                }

            }

        }

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

    private fromPullback(

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

            reason: result.pullback.reason,

            setupType: "PULLBACK"

        };

    }

    private fromTightBase(

        symbol: string,

        result: SwingTightBaseResult

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

            reason: result.base.reason,

            setupType: "TIGHT_BASE"

        };

    }

}
