/**
 * Sniper
 * Trend Continuation Playbook
 *
 * Version: 2.0
 *
 * Decision Trace architecture.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { PullbackEngine } from "../engines/PullbackEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

import {
    Playbook,
    ValidationResult
} from "./Playbook.js";

export interface TrendContinuationResult {

    playbook: string;

    qualified: boolean;

    trend: ReturnType<TrendQualification["evaluate"]>;

    pullback: ReturnType<PullbackEngine["evaluate"]>;

    confirmation: ReturnType<ConfirmationEngine["evaluate"]>;

    risk: ReturnType<RiskEngine["evaluate"]>;

    score: number;

}

export class TrendContinuation
implements Playbook<TrendContinuationResult> {

    private trend =
        new TrendQualification();

    private pullback =
        new PullbackEngine();

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
    ): TrendContinuationResult {

        const trend =
            this.trend.evaluate(candles);

        const pullback =
            this.pullback.evaluate(
                candles,
                trend
            );

        const confirmation =
            this.confirmation.evaluate(
                candles,
                pullback.candleIndex
            );

        const defaultRisk = {

        valid: false,

        entry: 0,

        stop: 0,

        target: 0,

        riskReward: 0,

        targetSource: "NONE" as const

};

        if (

            trend.direction === "NONE" ||

            pullback.level === "NONE"

        ) {

            return {

                playbook:
                    "Trend Continuation",

                qualified: false,

                trend,

                pullback,

                confirmation,

                risk: defaultRisk,

                score: 0

            };

        }

        const risk =

            confirmation.confirmed

                ? this.risk.evaluate(

                    candles,

                    trend,

                    confirmation

                )

                : defaultRisk;

        const score =
            this.score.evaluate({

                trend: 30,

                playbook: 25,

                confirmation:
                    confirmation.score,

                risk:
                    this.score.evaluateRisk(
                        risk.riskReward
                    ),

                entry:

                    confirmation.confirmed

                        ? this.score.evaluateEntry(

                            candles.length - 1 -
                            confirmation.candleIndex

                        )

                        : 0

            });

        return {

            playbook:
                "Trend Continuation",

            qualified:
            risk.valid,

            trend,

            pullback,

            confirmation,

            risk,

            score

        };

    }

    validate(

        candles: Candle[],

        result: TrendContinuationResult

    ): ValidationResult {

        if (!result.qualified) {

            return {

                active: false,

                reason: "Not Qualified"

            };

        }

        const last =
            candles[candles.length - 1];

        if (

            result.trend.direction === "BULLISH" &&

            last.close < result.trend.ema20

        ) {

            return {

                active: false,

                reason: "Lost EMA20"

            };

        }

        if (

            result.trend.direction === "BEARISH" &&

            last.close > result.trend.ema20

        ) {

            return {

                active: false,

                reason: "Lost EMA20"

            };

        }

        return {

            active: true,

            reason: ""

        };

    }

           //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: TrendContinuationResult
    ): DecisionTrace {

        this.traceEngine.reset();

        //--------------------------------------------------
        // Merge Engine Traces
        //--------------------------------------------------

        this.traceEngine.addSteps(

            this.trend.trace(
                result.trend
            )

        );

        this.traceEngine.addSteps(

            this.pullback.trace(
                result.pullback
            )

        );

        this.traceEngine.addSteps(

            this.confirmation.trace(
                result.confirmation
            )

        );

        this.traceEngine.addSteps(

            this.risk.trace(
                result.risk
            )

        );

        //--------------------------------------------------
        // Overall Score
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Score",

            `${result.score}/100`,

            result.qualified

                ? "Qualified setup"

                : "Setup not qualified"

        );

        //--------------------------------------------------
        // Final Trace
        //--------------------------------------------------

        return this.traceEngine.build();

    }

}