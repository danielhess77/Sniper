/**
 * Sniper
 * VWAP Reclaim Playbook
 *
 * Version: 3.0
 *
 * Decision Trace architecture.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { VWAPReclaimEngine } from "../engines/VWAPReclaimEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import {
    RiskEngine,
    RiskResult
} from "../engines/RiskEngine.js";
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

        const confirmation =
            this.confirmation.evaluate(

                candles,

                reclaim.candleIndex

            );

        const defaultRisk: RiskResult = {

        valid: false,

        entry: 0,

        stop: 0,

        target: 0,

        riskReward: 0,

        targetSource: "NONE"

};

        if (

            trend.direction === "NONE" ||

            !reclaim.reclaimed

        ) {

            return {

                playbook:
                    "VWAP Reclaim",

                qualified: false,

                trend,

                reclaim,

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
                "VWAP Reclaim",

            qualified:
            risk.valid,

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

            return {

                active: false,

                reason: "Not Qualified"

            };

        }

        const last =
            candles[candles.length - 1];

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (

            result.trend.direction === "BULLISH" &&

            last.close < result.trend.vwap

        ) {

            return {

                active: false,

                reason: "Lost VWAP"

            };

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        if (

            result.trend.direction === "BEARISH" &&

            last.close > result.trend.vwap

        ) {

            return {

                active: false,

                reason: "Lost VWAP"

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
        result: VWAPReclaimResult
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

            this.reclaim.trace(
                result.reclaim
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

            result.qualified

                ? "VWAP reclaim confirmed"

                : "Requirements not fully met"

        );

        //--------------------------------------------------
        // Final Trace
        //--------------------------------------------------

        return this.traceEngine.build();

    }

}