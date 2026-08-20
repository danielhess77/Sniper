/**
 * Sniper
 * Swing Tight Base Breakout Playbook
 *
 * Version: 1.2
 *
 * Trend + top-30% RS + compressed base → close above base high.
 * hasBase && !triggered is an explicit Consolidation (watching) state.
 * ATR contraction gate (ATR7 < ATR20) required to qualify breakouts.
 * Longs only. Target capped by 2.5 × ATR (horizon config).
 */

import { Candle } from "../core/BDKClient.js";
import { SwingHorizonConfig } from "../config/SwingHorizons.js";
import { SwingTrendEngine, SwingTrendResult } from "../engines/SwingTrendEngine.js";
import { TightBaseEngine, TightBaseResult } from "../engines/TightBaseEngine.js";
import {
    AtrContractionEngine,
    AtrContractionResult
} from "../engines/AtrContractionEngine.js";
import { RiskEngine, RiskResult } from "../engines/RiskEngine.js";
import { RsCard } from "../engines/RelativeStrengthEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";
import { SwingState } from "./SwingPlaybook.js";

export type TightBasePhase =
    | "NONE"
    | "CONSOLIDATION"
    | "BREAKOUT";

export interface SwingTightBaseResult {

    playbook: string;

    horizon: string;

    horizonId: string;

    state: SwingState;

    qualified: boolean;

    score: number;

    trend: SwingTrendResult;

    base: TightBaseResult;

    contraction: AtrContractionResult;

    risk: RiskResult;

    rsRank: number;

    rs: number;

    rsPercentile: number;

    atr: number;

    /** CONSOLIDATION = tight base, no breakout yet */
    phase: TightBasePhase;

    setupType: "TIGHT_BASE" | "CONSOLIDATION";

}

export class SwingTightBasePlaybook {

    private trendEngine =
        new SwingTrendEngine();

    private baseEngine =
        new TightBaseEngine();

    private contractionEngine =
        new AtrContractionEngine();

    private riskEngine =
        new RiskEngine();

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(

        dailyCandles: Candle[],

        horizon: SwingHorizonConfig,

        rs: RsCard | null

    ): SwingTightBaseResult {

        const noneRisk: RiskResult = {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

        const trend =
            this.trendEngine.evaluate(dailyCandles, horizon);

        const base =
            this.baseEngine.evaluate(dailyCandles);

        const contraction =
            this.contractionEngine.evaluate(dailyCandles);

        const atr = base.atr;

        const pack = (

            state: SwingState,

            risk: RiskResult,

            score: number,

            phase: TightBasePhase

        ): SwingTightBaseResult => ({

            playbook:
                phase === "CONSOLIDATION"

                    ? `${horizon.label} · Consolidation`

                    : `${horizon.label} · Tight Base`,

            horizon: horizon.label,

            horizonId: horizon.id,

            state,

            qualified: state === "qualified",

            score,

            trend,

            base,

            contraction,

            risk,

            rsRank: rs?.rank ?? 0,

            rs: rs?.rs ?? 0,

            rsPercentile: rs?.percentile ?? 0,

            atr,

            phase,

            setupType:
                phase === "CONSOLIDATION"

                    ? "CONSOLIDATION"

                    : "TIGHT_BASE"

        });

        if (!trend.valid) {

            return pack("invalid", noneRisk, 0, "NONE");

        }

        if (!rs || !rs.passesTop30) {

            return pack("invalid", noneRisk, 0, "NONE");

        }

        if (!base.hasBase) {

            return pack(

                "invalid",

                noneRisk,

                this.score(trend, base, contraction, noneRisk, rs, false),

                "NONE"

            );

        }

        // —— Consolidation: compressed base, waiting for breakout ——
        if (!base.triggered) {

            const coilNote = contraction.contracting

                ? `ATR coil ${contraction.ratio.toFixed(2)}×`

                : "no ATR coil yet";

            const watchRisk: RiskResult = {

                valid: false,

                // Surface levels to watch (not a live entry)
                entry: base.baseHigh,

                stop: base.baseLow,

                target: 0,

                riskReward: 0

            };

            // Encode human reason on base for scanner card
            base.reason =
                `Consolidation ${base.baseLow.toFixed(2)}–${base.baseHigh.toFixed(2)} ` +

                `(${base.baseBars}d, ${base.compression.toFixed(2)}×ATR, ${coilNote}) — wait close > ${base.baseHigh.toFixed(2)}`;

            return pack(

                "watching",

                watchRisk,

                this.score(trend, base, contraction, noneRisk, rs, false),

                "CONSOLIDATION"

            );

        }

        const entry = base.entry;

        const stop = base.baseLow;

        const measured =
            entry + base.baseHeight;

        const atrCap =
            atr > 0

                ? entry + horizon.atrTargetMultiple * atr

                : measured;

        const target =
            Math.min(measured, atrCap);

        const risk =
            this.riskEngine.evaluateTrade(

                entry,

                stop,

                target,

                {

                    minRiskReward: horizon.minRiskReward,

                    minRiskDollars: horizon.minRiskDollars,

                    minRiskPct: horizon.minRiskPct

                }

            );

        if (!risk.valid) {

            return pack(

                "triggered",

                risk,

                this.score(trend, base, contraction, risk, rs, true),

                "BREAKOUT"

            );

        }

        if (!contraction.contracting) {

            return pack(

                "triggered",

                risk,

                this.score(trend, base, contraction, risk, rs, true),

                "BREAKOUT"

            );

        }

        return pack(

            "qualified",

            risk,

            this.score(trend, base, contraction, risk, rs, true),

            "BREAKOUT"

        );

    }

    private score(

        trend: SwingTrendResult,

        base: TightBaseResult,

        contraction: AtrContractionResult,

        risk: RiskResult,

        rs: RsCard,

        triggered: boolean

    ): number {

        let total = 0;

        if (trend.valid) {

            total += 20;

            if (trend.soft50Ok) total += 5;

        }

        total += Math.round((rs.percentile / 100) * 22);

        if (base.hasBase) {

            total += 10;

            if (base.compression <= 1.0) total += 8;

            else if (base.compression <= 1.2) total += 5;

            if (base.baseBars >= 8) total += 3;

        }

        if (contraction.contracting) {

            total += 10;

            if (contraction.ratio > 0 && contraction.ratio <= 0.85) total += 3;

        }

        if (triggered && base.triggered) {

            total += 12;

        }

        if (risk.valid) {

            if (risk.riskReward >= 2.5) total += 12;

            else if (risk.riskReward >= 2.0) total += 10;

            else if (risk.riskReward >= 1.5) total += 6;

            else total += 3;

        }

        return Math.min(100, total);

    }

    trace(

        result: SwingTightBaseResult

    ): DecisionTrace {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Trend",

            result.trend.valid,

            result.trend.direction,

            result.trend.reason

        );

        this.traceEngine.add(

            "Relative Strength",

            result.rsRank > 0 && result.rsPercentile >= 70,

            `Rank #${result.rsRank} (${result.rsPercentile.toFixed(0)}th %ile)`,

            `RS ${(result.rs * 100).toFixed(2)}% vs SPY`

        );

        this.traceEngine.add(

            "Consolidation",

            result.base.hasBase,

            result.base.hasBase

                ? `${result.base.baseLow.toFixed(2)}–${result.base.baseHigh.toFixed(2)}`

                : "—",

            result.base.reason

        );

        this.traceEngine.add(

            "ATR Contraction",

            result.contraction.contracting,

            result.contraction.ratio > 0

                ? `${result.contraction.ratio.toFixed(2)}×`

                : "—",

            result.contraction.reason

        );

        this.traceEngine.add(

            "Breakout",

            result.base.triggered,

            result.base.triggered

                ? `Entry ${result.base.entry.toFixed(2)}`

                : "Waiting",

            result.base.triggered

                ? "Close above base high"

                : "No breakout yet — consolidation only"

        );

        this.traceEngine.addInfo(

            "Compression",

            result.base.compression

                ? `${result.base.compression.toFixed(2)}×ATR`

                : "—",

            `${result.base.baseBars} base bars`

        );

        this.traceEngine.addSteps(

            this.riskEngine.trace(result.risk)

        );

        this.traceEngine.addInfo(

            "Phase",

            result.phase,

            result.phase === "CONSOLIDATION"

                ? "In base — not an entry yet"

                : result.qualified

                    ? "Qualified tight-base breakout (coiled)"

                    : result.base.triggered && !result.contraction.contracting

                        ? "Breakout without ATR coil — not qualified"

                        : "Not qualified"

        );

        this.traceEngine.addInfo(

            "Score",

            `${result.score}/100`

        );

        return this.traceEngine.build();

    }

}
