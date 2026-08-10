/**
 * Sniper — First Pullback — v3.1 structure-first
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { PullbackEngine } from "../engines/PullbackEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";
import { Playbook, ValidationResult } from "./Playbook.js";

export interface FirstPullbackResult {
    playbook: string;
    qualified: boolean;
    trend: ReturnType<TrendQualification["evaluate"]>;
    pullback: ReturnType<PullbackEngine["evaluate"]>;
    confirmation: ReturnType<ConfirmationEngine["evaluate"]>;
    risk: ReturnType<RiskEngine["evaluate"]>;
    score: number;
}

export class FirstPullback implements Playbook<FirstPullbackResult> {
    private trend = new TrendQualification();
    private pullback = new PullbackEngine();
    private confirmation = new ConfirmationEngine();
    private risk = new RiskEngine();
    private score = new ScoreEngine();
    private traceEngine = new DecisionTraceEngine();

    evaluate(candles: Candle[]): FirstPullbackResult {
        const trend = this.trend.evaluate(candles);
        const pullback = this.pullback.evaluate(candles, trend);
        const signalIdx = pullback.candleIndex >= 0 ? pullback.candleIndex : 0;
        const confirmation = this.confirmation.evaluate(candles, signalIdx);
        const defaultRisk = this.risk.evaluateTrade(0, 0, 0);

        if (trend.direction === "NONE" || pullback.level === "NONE") {
            return {
                playbook: "First Pullback",
                qualified: false,
                trend,
                pullback,
                confirmation,
                risk: defaultRisk,
                score: 0
            };
        }

        const confForRisk = confirmation.confirmed
            ? confirmation
            : { ...confirmation, confirmed: true, candleIndex: pullback.candleIndex, score: 10 };

        const risk = this.risk.evaluate(candles, trend, confForRisk);
        const qualified =
            risk.valid && (confirmation.confirmed || risk.riskReward >= 1.5);

        const score = this.score.evaluate({
            trend: 30,
            playbook: pullback.level === "EMA9" ? 25 : 20,
            confirmation: confirmation.confirmed ? confirmation.score : 10,
            risk: this.score.evaluateRisk(risk.riskReward),
            entry:
                pullback.candleIndex >= 0
                    ? this.score.evaluateEntry(
                          Math.max(0, candles.length - 1 - pullback.candleIndex)
                      )
                    : 0
        });

        return {
            playbook: "First Pullback",
            qualified,
            trend,
            pullback,
            confirmation,
            risk,
            score
        };
    }

    validate(candles: Candle[], result: FirstPullbackResult): ValidationResult {
        if (!result.qualified) return { active: false, reason: "Not Qualified" };
        const last = candles[candles.length - 1];
        if (result.trend.direction === "BULLISH" && last.close < result.trend.ema20) {
            return { active: false, reason: "Trend Failed" };
        }
        if (result.trend.direction === "BEARISH" && last.close > result.trend.ema20) {
            return { active: false, reason: "Trend Failed" };
        }
        return { active: true, reason: "" };
    }

    trace(result: FirstPullbackResult): DecisionTrace {
        this.traceEngine.reset();
        this.traceEngine.addSteps(this.trend.trace(result.trend));
        this.traceEngine.addSteps(this.pullback.trace(result.pullback));
        this.traceEngine.addSteps(this.confirmation.trace(result.confirmation));
        this.traceEngine.addSteps(this.risk.trace(result.risk));
        this.traceEngine.addInfo(
            "Score",
            `${result.score}/100`,
            result.qualified ? "Qualified setup" : "Setup not qualified"
        );
        return this.traceEngine.build();
    }
}
