/**
 * Sniper
 * Option Select Engine
 *
 * Version: 2.0
 *
 * Long premium only.
 * Profiles:
 *  - 0DTE / nearest: Δ 0.35–0.50, spread ≤12%, OI ≥50
 *  - SHORT swing: DTE 5–10, Δ 0.40–0.55
 *  - INTERMEDIATE swing: DTE 21–35, Δ 0.35–0.50, spread ≤15%, OI ≥100
 */

import { BDKClient, OptionChainResult, OptionContract } from "../core/BDKClient.js";
import type { OptionSuggestion } from "../types.js";

export type OptionProfileId = "ZERO_DTE" | "SWING_SHORT" | "SWING_INTERMEDIATE";

interface OptionProfile {

    id: OptionProfileId;

    side: "CALL" | "PUT" | "FROM_DIRECTION";

    dteMin: number;

    dteMax: number;

    /** Prefer expiry closest to this DTE when several fall in band */
    dteTarget: number;

    deltaMin: number;

    deltaMax: number;

    deltaIdeal: number;

    maxSpreadPct: number;

    minOi: number;

}

const PROFILES: Record<OptionProfileId, OptionProfile> = {

    ZERO_DTE: {

        id: "ZERO_DTE",

        side: "FROM_DIRECTION",

        dteMin: 0,

        dteMax: 3,

        dteTarget: 0,

        deltaMin: 0.35,

        deltaMax: 0.50,

        deltaIdeal: 0.40,

        maxSpreadPct: 0.12,

        minOi: 50

    },

    SWING_SHORT: {

        id: "SWING_SHORT",

        side: "CALL",

        dteMin: 5,

        dteMax: 10,

        dteTarget: 7,

        deltaMin: 0.40,

        deltaMax: 0.55,

        deltaIdeal: 0.45,

        maxSpreadPct: 0.12,

        minOi: 50

    },

    SWING_INTERMEDIATE: {

        id: "SWING_INTERMEDIATE",

        side: "CALL",

        dteMin: 21,

        dteMax: 35,

        dteTarget: 28,

        deltaMin: 0.35,

        deltaMax: 0.50,

        deltaIdeal: 0.40,

        maxSpreadPct: 0.15,

        minOi: 100

    }

};

export class OptionSelectEngine {

    private static readonly CHAIN_CACHE_MS = 45 * 60_000;

    private chainCache =
        new Map<string, { expiresAt: number; chain: OptionChainResult }>();

    constructor(

        private bdk: BDKClient

    ) {}

    /** Intraday / 0DTE directional long call or put */
    async suggest(

        underlying: string,

        direction: "BULLISH" | "BEARISH" | "NONE"

    ): Promise<OptionSuggestion | null> {

        if (direction !== "BULLISH" && direction !== "BEARISH") {

            return null;

        }

        const side: "CALL" | "PUT" =
            direction === "BULLISH" ? "CALL" : "PUT";

        return this.suggestWithProfile(underlying, side, PROFILES.ZERO_DTE);

    }

    /** Swing long call by horizon */
    async suggestSwing(

        underlying: string,

        horizonId: string

    ): Promise<OptionSuggestion | null> {

        const profile =
            horizonId === "INTERMEDIATE"

                ? PROFILES.SWING_INTERMEDIATE

                : PROFILES.SWING_SHORT;

        return this.suggestWithProfile(underlying, "CALL", profile);

    }

    private async suggestWithProfile(

        underlying: string,

        side: "CALL" | "PUT",

        profile: OptionProfile

    ): Promise<OptionSuggestion> {

        try {

            const chain =
                await this.getChainCached(underlying);

            const map =
                side === "CALL"

                    ? chain.callExpDateMap

                    : chain.putExpDateMap;

            if (!map || Object.keys(map).length === 0) {

                return this.fail(side, "No chain data");

            }

            const expKey =
                this.pickExpiration(map, profile);

            if (!expKey) {

                return this.fail(

                    side,

                    `No expiry in DTE ${profile.dteMin}–${profile.dteMax}`

                );

            }

            const strikeMap = map[expKey];

            const candidates: OptionContract[] = [];

            for (const strike of Object.keys(strikeMap)) {

                const list = strikeMap[strike];

                if (!list?.length) continue;

                candidates.push(list[0]);

            }

            const scored =
                candidates
                    .map(c => this.scoreContract(c, side, profile))
                    .filter((x): x is NonNullable<typeof x> => x !== null)
                    .sort((a, b) => b.score - a.score);

            if (!scored.length) {

                return this.fail(

                    side,

                    `No liquid ${side} in Δ ${profile.deltaMin}–${profile.deltaMax}, DTE ${profile.dteMin}–${profile.dteMax}`

                );

            }

            return scored[0].suggestion;

        } catch (err) {

            console.error(`Option select failed: ${underlying}`, err);

            return this.fail(

                side,

                err instanceof Error ? err.message : "Chain request failed"

            );

        }

    }

    private async getChainCached(

        symbol: string

    ): Promise<OptionChainResult> {

        const key = symbol.toUpperCase();

        const hit = this.chainCache.get(key);

        if (hit && hit.expiresAt > Date.now()) {

            return hit.chain;

        }

        const chain =
            await this.bdk.getOptionChain(key);

        this.chainCache.set(key, {

            expiresAt: Date.now() + OptionSelectEngine.CHAIN_CACHE_MS,

            chain

        });

        return chain;

    }

    private pickExpiration(

        map: Record<string, Record<string, OptionContract[]>>,

        profile: OptionProfile

    ): string | null {

        // Keys like "2026-08-10:2"
        const scored: { key: string; dte: number; dist: number }[] = [];

        for (const key of Object.keys(map)) {

            const dte = Number(key.split(":")[1] ?? NaN);

            if (Number.isNaN(dte)) continue;

            if (dte < profile.dteMin || dte > profile.dteMax) continue;

            scored.push({

                key,

                dte,

                dist: Math.abs(dte - profile.dteTarget)

            });

        }

        if (!scored.length) {

            // Fallback: nearest overall expiry for ZERO_DTE-style
            if (profile.id === "ZERO_DTE") {

                const all = Object.keys(map).sort((a, b) => {

                    const da = Number(a.split(":")[1] ?? 999);

                    const db = Number(b.split(":")[1] ?? 999);

                    return da - db;

                });

                return all[0] ?? null;

            }

            return null;

        }

        scored.sort((a, b) => a.dist - b.dist || a.dte - b.dte);

        return scored[0].key;

    }

    private scoreContract(

        c: OptionContract,

        side: "CALL" | "PUT",

        profile: OptionProfile

    ): { score: number; suggestion: OptionSuggestion } | null {

        const bid = Number(c.bid) || 0;

        const ask = Number(c.ask) || 0;

        const deltaRaw = Number(c.delta);

        const absDelta = Math.abs(deltaRaw);

        const oi = Number(c.openInterest) || 0;

        const volume = Number(c.totalVolume) || 0;

        if (ask <= 0) return null;

        if (absDelta < profile.deltaMin || absDelta > profile.deltaMax) {

            return null;

        }

        if (oi < profile.minOi) return null;

        const mid = bid > 0 ? (bid + ask) / 2 : ask;

        if (mid <= 0) return null;

        const spreadPct = (ask - bid) / mid;

        if (spreadPct > profile.maxSpreadPct) return null;

        const deltaRange = profile.deltaMax - profile.deltaMin || 0.15;

        const deltaScore =
            1 - Math.abs(absDelta - profile.deltaIdeal) / deltaRange;

        const spreadScore =
            1 - spreadPct / profile.maxSpreadPct;

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

            reason:
                `Δ ${absDelta.toFixed(2)} · spread ${(spreadPct * 100).toFixed(1)}% · OI ${oi} · ${profile.id}`

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
