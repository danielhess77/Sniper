/**
 * Sniper
 * Swing Playbook
 *
 * Version: 1.1
 *
 * One playbook, two horizons via SwingHorizonConfig.
 * Longs only in v1.
 *
 * Target = min(measured-move impulse, entry + atrTargetMultiple * ATR14)
 */

import { Candle } from "../core/BDKClient.js";
import { SwingHorizonConfig } from "../config/SwingHorizons.js";
import { SwingTrendEngine, SwingTrendResult } from "../engines/SwingTrendEngine.js";
import { SwingPullbackEngine, SwingPullbackResult } from "../engines/SwingPullbackEngine.js";
import { RiskEngine, RiskResult } from "../engines/RiskEngine.js";
import { RsCard } from "../engines/RelativeStrengthEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

export type SwingState =
    | "watching"
    | "triggered"
    | "qualified"
    | "invalid";

export interface SwingResult {

    playbook: string;

    horizon: string;

    horizonId: string;

    state: SwingState;

    qualified: boolean;

    score: number;

    trend: SwingTrendResult;

    pullback: SwingPullbackResult;

    risk: RiskResult;

    rsRank: number;

    rs: number;

    rsPercentile: number;

    atr: number;

}

export class SwingPlaybook {

    private static readonly ATR_PERIOD = 14;

    private trendEngine =
        new SwingTrendEngine();

    private pullbackEngine =
        new SwingPullbackEngine();

    private riskEngine =
        new RiskEngine();

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(

        dailyCandles: Candle[],

        horizon: SwingHorizonConfig,

        rs: RsCard | null

    ): SwingResult {

        const atr =
            this.atr(dailyCandles, SwingPlaybook.ATR_PERIOD);

        const base = (

            state: SwingState,

            trend: SwingTrendResult,

            pullback: SwingPullbackResult,

            risk: RiskResult,

            score: number

        ): SwingResult => ({

            playbook: horizon.label,

            horizon: horizon.label,

            horizonId: horizon.id,

            state,

            qualified: state === "qualified",

            score,

            trend,

            pullback,

            risk,

            rsRank: rs?.rank ?? 0,

            rs: rs?.rs ?? 0,

            rsPercentile: rs?.percentile ?? 0,

            atr

        });

        const noneRisk: RiskResult = {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

        const trend =
            this.trendEngine.evaluate(

                dailyCandles,

                horizon

            );

        if (!trend.valid) {

            return base(

                "invalid",

                trend,

                this.pullbackEngine.evaluate(dailyCandles, trend.ema20 || 0),

                noneRisk,

                0

            );

        }

        if (!rs || !rs.passesTop30) {

            const pullback =
                this.pullbackEngine.evaluate(

                    dailyCandles,

                    trend.ema20

                );

            return base(

                "invalid",

                trend,

                pullback,

                noneRisk,

                0

            );

        }

        const pullback =
            this.pullbackEngine.evaluate(

                dailyCandles,

                trend.ema20

            );

        if (!pullback.hasPullback) {

            return base(

                "invalid",

                trend,

                pullback,

                noneRisk,

                this.score(trend, pullback, noneRisk, rs, false)

            );

        }

        if (!pullback.triggered) {

            return base(

                "watching",

                trend,

                pullback,

                noneRisk,

                this.score(trend, pullback, noneRisk, rs, false)

            );

        }

        // Geometry: stop under pullback low
        // Target = min(measured move, entry + 2.5 * ATR)
        const entry =
            pullback.entry;

        const stop =
            pullback.pullbackLow;

        const measuredMoveTarget =
            entry + pullback.impulseSize;

        const atrCapTarget =
            atr > 0

                ? entry + horizon.atrTargetMultiple * atr

                : measuredMoveTarget;

        const target =
            Math.min(measuredMoveTarget, atrCapTarget);

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

            return base(

                "triggered",

                trend,

                pullback,

                risk,

                this.score(trend, pullback, risk, rs, true)

            );

        }

        return base(

            "qualified",

            trend,

            pullback,

            risk,

            this.score(trend, pullback, risk, rs, true)

        );

    }

    private atr(

        candles: Candle[],

        period: number

    ): number {

        if (candles.length < period + 1) {

            return 0;

        }

        const trs: number[] = [];

        for (let i = 1; i < candles.length; i++) {

            const c = candles[i];

            const prev = candles[i - 1];

            const tr = Math.max(

                c.high - c.low,

                Math.abs(c.high - prev.close),

                Math.abs(c.low - prev.close)

            );

            trs.push(tr);

        }

        if (trs.length < period) {

            return 0;

        }

        // Wilder ATR: SMA seed, then smoothed
        let atr =
            trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < trs.length; i++) {

            atr = (atr * (period - 1) + trs[i]) / period;

        }

        return atr;

    }

    private score(

        trend: SwingTrendResult,

        pullback: SwingPullbackResult,

        risk: RiskResult,

        rs: RsCard,

        triggered: boolean

    ): number {

        let total = 0;

        if (trend.valid) {

            total += 20;

            if (trend.soft50Ok) total += 5;

        }

        total += Math.round(

            (rs.percentile / 100) * 25

        );

        if (pullback.hasPullback) {

            total += 12;

            if (pullback.pullbackLow <= trend.ema20 * 1.01) {

                total += 8;

            }

        }

        if (triggered && pullback.triggered) {

            total += 15;

        }

        if (risk.valid) {

            if (risk.riskReward >= 2.5) total += 15;

            else if (risk.riskReward >= 2.0) total += 12;

            else if (risk.riskReward >= 1.5) total += 8;

            else total += 4;

        }

        return Math.min(100, total);

    }

    trace(

        result: SwingResult

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

            "Pullback",

            result.pullback.hasPullback,

            result.pullback.hasPullback

                ? `Low ${result.pullback.pullbackLow.toFixed(2)}`

                : "—",

            result.pullback.reason

        );

        this.traceEngine.add(

            "Trigger",

            result.pullback.triggered,

            result.pullback.triggered

                ? `Entry ${result.pullback.entry.toFixed(2)}`

                : "Waiting",

            result.pullback.reason

        );

        this.traceEngine.addInfo(

            "ATR(14)",

            result.atr > 0

                ? result.atr.toFixed(2)

                : "—",

            "Target capped at 2.5 × ATR"

        );

        this.traceEngine.addSteps(

            this.riskEngine.trace(result.risk)

        );

        this.traceEngine.addInfo(

            "State",

            result.state,

            result.qualified

                ? "Qualified swing setup"

                : "Not qualified"

        );

        this.traceEngine.addInfo(

            "Score",

            `${result.score}/100`

        );

        return this.traceEngine.build();

    }

}
