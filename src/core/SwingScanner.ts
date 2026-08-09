/**
 * Sniper
 * Swing Scanner
 *
 * Version: 1.3
 *
 * Adds qualifiedAt from the daily trigger bar.
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

    /** Display: ET date of trigger bar */
    triggerTime: string;

    /** ISO of trigger daily bar (when setup became valid) */
    qualifiedAt: string | null;

    option?: OptionSuggestion | null;

}

function formatEtDate(ms: number): string {

    return new Date(ms).toLocaleDateString("en-US", {

        timeZone: "America/New_York",

        month: "short",

        day: "numeric",

        year: "numeric"

    });

}

function barTime(

    candles: Candle[],

    index: number

): { display: string; iso: string | null } {

    if (index < 0 || index >= candles.length) {

        return { display: "—", iso: null };

    }

    const ms = Number(candles[index].datetime);

    if (!Number.isFinite(ms)) {

        return { display: "—", iso: null };

    }

    return {

        display: formatEtDate(ms),

        iso: new Date(ms).toISOString()

    };

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

                        this.fromPullback(history.symbol, history.candles, pullback)

                    );

                }

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

                        this.fromTightBase(history.symbol, history.candles, tight)

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

        candles: Candle[],

        result: SwingResult

    ): SwingCard {

        const t =
            barTime(candles, result.pullback.triggerIndex);

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

            setupType: "PULLBACK",

            triggerTime: t.display,

            qualifiedAt: result.qualified ? t.iso : null

        };

    }

    private fromTightBase(

        symbol: string,

        candles: Candle[],

        result: SwingTightBaseResult

    ): SwingCard {

        const t =
            barTime(candles, result.base.triggerIndex);

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

            setupType: "TIGHT_BASE",

            triggerTime: t.display,

            qualifiedAt: result.qualified ? t.iso : null

        };

    }

}
