/**
 * Sniper
 * Option Select Engine
 *
 * Version: 1.0
 *
 * For long premium directional trades:
 * BULLISH → CALL, BEARISH → PUT
 * Prefer liquid contracts in a practical delta band.
 */

import { BDKClient, OptionContract } from "../core/BDKClient.js";
import type { OptionSuggestion } from "../types.js";

export class OptionSelectEngine {

    /** Prefer this absolute delta range for directional 0DTE / short-dated */
    private static readonly DELTA_MIN = 0.35;

    private static readonly DELTA_MAX = 0.50;

    /** Max (ask - bid) / mid */
    private static readonly MAX_SPREAD_PCT = 0.12;

    private static readonly MIN_OI = 50;

    constructor(

        private bdk: BDKClient

    ) {}

    async suggest(

        underlying: string,

        direction: "BULLISH" | "BEARISH" | "NONE"

    ): Promise<OptionSuggestion | null> {

        if (direction !== "BULLISH" && direction !== "BEARISH") {

            return null;

        }

        const side: "CALL" | "PUT" =
            direction === "BULLISH" ? "CALL" : "PUT";

        try {

            const chain =
                await this.bdk.getOptionChain(underlying);

            const map =
                side === "CALL"

                    ? chain.callExpDateMap

                    : chain.putExpDateMap;

            if (!map || Object.keys(map).length === 0) {

                return this.fail(side, "No chain data");

            }

            // Prefer nearest expiration (0DTE when present)
            const expKeys =
                Object.keys(map).sort((a, b) => {

                    const da = Number(a.split(":")[1] ?? 999);

                    const db = Number(b.split(":")[1] ?? 999);

                    return da - db;

                });

            const expKey = expKeys[0];

            const strikeMap = map[expKey];

            const candidates: OptionContract[] = [];

            for (const strike of Object.keys(strikeMap)) {

                const list = strikeMap[strike];

                if (!list?.length) continue;

                candidates.push(list[0]);

            }

            const scored =
                candidates
                    .map(c => this.scoreContract(c, side))
                    .filter((x): x is NonNullable<typeof x> => x !== null)
                    .sort((a, b) => b.score - a.score);

            if (!scored.length) {

                return this.fail(

                    side,

                    "No liquid contract in delta 0.35–0.50 with spread ≤12%"

                );

            }

            const best = scored[0];

            return best.suggestion;

        } catch (err) {

            console.error(`Option select failed: ${underlying}`, err);

            return this.fail(

                side,

                err instanceof Error ? err.message : "Chain request failed"

            );

        }

    }

    private scoreContract(

        c: OptionContract,

        side: "CALL" | "PUT"

    ): { score: number; suggestion: OptionSuggestion } | null {

        const bid = Number(c.bid) || 0;

        const ask = Number(c.ask) || 0;

        const deltaRaw = Number(c.delta);

        const absDelta = Math.abs(deltaRaw);

        const oi = Number(c.openInterest) || 0;

        const volume = Number(c.totalVolume) || 0;

        if (ask <= 0) return null;

        if (absDelta < OptionSelectEngine.DELTA_MIN) return null;

        if (absDelta > OptionSelectEngine.DELTA_MAX) return null;

        if (oi < OptionSelectEngine.MIN_OI) return null;

        const mid = bid > 0 ? (bid + ask) / 2 : ask;

        if (mid <= 0) return null;

        const spreadPct = (ask - bid) / mid;

        if (spreadPct > OptionSelectEngine.MAX_SPREAD_PCT) return null;

        // Prefer tighter spreads, higher volume, closer to 0.40 delta
        const deltaScore =
            1 - Math.abs(absDelta - 0.40) / 0.15;

        const spreadScore =
            1 - spreadPct / OptionSelectEngine.MAX_SPREAD_PCT;

        const volumeScore =
            Math.min(1, Math.log10(volume + 1) / 3);

        const oiScore =
            Math.min(1, Math.log10(oi + 1) / 4);

        const score =
            deltaScore * 0.35 +
            spreadScore * 0.35 +
            volumeScore * 0.15 +
            oiScore * 0.15;

        const exp =
            typeof c.expirationDate === "string"

                ? c.expirationDate.slice(0, 10)

                : String(c.expirationDate);

        const suggestion: OptionSuggestion = {

            ok: true,

            side,

            symbol: c.symbol,

            description: c.description || c.symbol,

            strike: Number(c.strikePrice),

            expiration: exp,

            dte: Number(c.daysToExpiration) || 0,

            bid,

            ask,

            mid: Number(mid.toFixed(2)),

            spreadPct: Number((spreadPct * 100).toFixed(1)),

            delta: Number(deltaRaw.toFixed(3)),

            openInterest: oi,

            volume,

            reason: `Δ ${absDelta.toFixed(2)} · spread ${ (spreadPct * 100).toFixed(1) }% · OI ${oi}`

        };

        return { score, suggestion };

    }

    private fail(

        side: "CALL" | "PUT",

        reason: string

    ): OptionSuggestion {

        return {

            ok: false,

            side,

            symbol: "",

            description: "",

            strike: 0,

            expiration: "",

            dte: 0,

            bid: 0,

            ask: 0,

            mid: 0,

            spreadPct: 0,

            delta: 0,

            openInterest: 0,

            volume: 0,

            reason

        };

    }

}
