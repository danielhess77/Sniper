/**
 * Sniper
 * VWAP Reclaim Playbook
 *
 * Version: 3.1 — structure-first (candle confirm optional)
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { VWAPReclaimEngine } from "../engines/VWAPReclaimEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

import {
    Playbook,
    ValidationResult
} from "./Playbook.js";

export interface VWAPReclaimResult {

    playbook: string;

    qualified: boolean;

    trend: ReturnType<TrendQualification["evaluate"]>;

    reclaim: ReturnType<VWAPReclaimEngine["evaluate"]>;

    confirmation: ReturnType<ConfirmationEngine["evaluate"]>;

    risk: ReturnType<RiskEngine["evaluate"]>;

    score: number;

}

export class VWAPReclaim
implements Playbook<VWAPReclaimResult> {

    private trend =
        new TrendQualification();

    private reclaim =
        new VWAPReclaimEngine();

    private confirmation =
        new ConfirmationEngine();

    private risk =
        new RiskEngine();

    private score =
        new ScoreEngine();

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(
        candles: Candle[]
    ): VWAPReclaimResult {

        const trend =
            this.trend.evaluate(candles);

        const reclaim =
            this.reclaim.evaluate(

                candles,

                trend.vwap,

                trend.direction

            );

        const signalIdx =
            reclaim.candleIndex >= 0 ? reclaim.candleIndex : 0;

        const confirmation =
            this.confirmation.evaluate(candles, signalIdx);

        const defaultRisk = {

            valid: false,
            entry: 0,
            stop: 0,
            target: 0,
            riskReward: 0

        };

        if (trend.direction === "NONE" || !reclaim.reclaimed) {

            return {

                playbook: "VWAP Reclaim",

                qualified: false,

                trend,

                reclaim,

                confirmation,

                risk: defaultRisk,

                score: 0

            };

        }

        // Use confirmation index if present, else reclaim bar
        const confForRisk =
            confirmation.confirmed

                ? confirmation

                : {

                    ...confirmation,

                    confirmed: true,

                    candleIndex: reclaim.candleIndex,

                    score: 10

                };

        const risk =
            this.risk.evaluate(candles, trend, confForRisk);

        const qualified =
            risk.valid &&
            (confirmation.confirmed || risk.riskReward >= 1.5);

        const score =
            this.score.evaluate({

                trend: 30,

                playbook: 25,

                confirmation:
                    confirmation.confirmed ? confirmation.score : 10,

                risk: this.score.evaluateRisk(risk.riskReward),

                entry:
                    reclaim.candleIndex >= 0

                        ? this.score.evaluateEntry(

                            Math.max(0, candles.length - 1 - reclaim.candleIndex)

                        )

                        : 0

            });

        return {

            playbook: "VWAP Reclaim",

            qualified,

            trend,

            reclaim,

            confirmation,

            risk,

            score

        };

    }

    validate(

        candles: Candle[],

        result: VWAPReclaimResult

    ): ValidationResult {

        if (!result.qualified) {

            return { active: false, reason: "Not Qualified" };

        }

        const last = candles[candles.length - 1];

        // Soft: only fail if clearly on wrong side of VWAP by a margin
        if (

            result.trend.direction === "BULLISH" &&
            last.close < result.trend.vwap * 0.998

        ) {

            return { active: false, reason: "Lost VWAP" };

        }

        if (

            result.trend.direction === "BEARISH" &&
            last.close > result.trend.vwap * 1.002

        ) {

            return { active: false, reason: "Lost VWAP" };

        }

        return { active: true, reason: "" };

    }

    trace(
        result: VWAPReclaimResult
    ): DecisionTrace {

        this.traceEngine.reset();

        this.traceEngine.addSteps(this.trend.trace(result.trend));

        this.traceEngine.addSteps(this.reclaim.trace(result.reclaim));

        this.traceEngine.addSteps(this.confirmation.trace(result.confirmation));

        this.traceEngine.addSteps(this.risk.trace(result.risk));

        this.traceEngine.addInfo(

            "Score",

            `${result.score}/100`,

            result.qualified ? "Qualified setup" : "Setup not qualified"

        );

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.qualified ? "VWAP reclaim" : "Requirements not fully met"

        );

        return this.traceEngine.build();

    }

}
