/**
 * Sniper
 * First Pullback Playbook
 *
 * Version: 3.0
 *
 * Decision Trace Architecture
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

export interface FirstPullbackResult {

    playbook: string;

    qualified: boolean;

    trend:
        ReturnType<TrendQualification["evaluate"]>;

    pullback:
        ReturnType<PullbackEngine["evaluate"]>;

    confirmation:
        ReturnType<ConfirmationEngine["evaluate"]>;

    risk:
        ReturnType<RiskEngine["evaluate"]>;

    score: number;

}

export class FirstPullback
implements Playbook<FirstPullbackResult> {

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
    ): FirstPullbackResult {

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

        const defaultRisk =
            this.risk.evaluateTrade(
                0,
                0,
                0
            );

        if (

            trend.direction === "NONE" ||

            pullback.level === "NONE"

        ) {

            return {

                playbook:
                    "First Pullback",

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

                playbook:

                    pullback.level === "EMA9"

                        ? 25

                        : 20,

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
                "First Pullback",

            qualified:

                confirmation.confirmed &&
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

        result: FirstPullbackResult

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

                reason: "Trend Failed"

            };

        }

        if (

            result.trend.direction === "BEARISH" &&
            last.close > result.trend.ema20

        ) {

            return {

                active: false,

                reason: "Trend Failed"

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
        result: FirstPullbackResult
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
        // Playbook
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.pullback.level === "EMA9"

                ? "First EMA9 Pullback"

                : result.pullback.level === "EMA20"

                    ? "First EMA20 Pullback"

                    : "No qualifying pullback"

        );

        //--------------------------------------------------
        // Final Trace
        //--------------------------------------------------

        return this.traceEngine.build();

    }

}