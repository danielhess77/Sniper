/**
 * Sniper
 * Swing Scanner
 *
 * Version: 1.0
 *
 * Fetches daily history for the watchlist + SPY,
 * ranks relative strength, evaluates Short + Intermediate
 * swing playbooks.
 */

import { BDKClient, Candle } from "./BDKClient.js";
import { SWING_HORIZONS } from "../config/SwingHorizons.js";
import { RelativeStrengthEngine } from "../engines/RelativeStrengthEngine.js";
import { SwingPlaybook, SwingResult } from "../playbooks/SwingPlaybook.js";

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

}

export class SwingScanner {

    private rsEngine =
        new RelativeStrengthEngine();

    private playbook =
        new SwingPlaybook();

    constructor(

        private bdk: BDKClient

    ) {}

    async scan(

        symbols: string[]

    ): Promise<SwingCard[]> {

        console.log("");
        console.log("========================================");
        console.log(`Swing scan: ${symbols.length} symbols`);
        console.log("========================================");

        // SPY + universe daily history
        const spyCandles =
            await this.bdk.getDailyHistory("SPY");

        const histories: { symbol: string; candles: Candle[] }[] = [];

        // Sequential with small concurrency to respect rate limits
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

                const trace =
                    this.playbook.trace(result);

                console.log(

                    `${history.symbol} [${horizon.id}] state=${result.state} score=${result.score} RR=${result.risk.riskReward.toFixed(2)}`

                );

                for (const step of trace.steps) {

                    if (step.type === "decision") {

                        console.log(

                            `  ${step.passed ? "✓" : "✗"} ${step.name}: ${step.reason ?? ""}`

                        );

                    }

                }

                // Surface watching + triggered + qualified
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

        cards.sort((a, b) => {

            // Qualified first, then by score
            if (a.qualified !== b.qualified) {

                return a.qualified ? -1 : 1;

            }

            return b.score - a.score;

        });

        console.log("");
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
