/**
 * Sniper
 * Trend Continuation Playbook
 *
 * Version: 0.8
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { PullbackEngine } from "../engines/PullbackEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { Playbook } from "./Playbook.js";

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

            riskReward: 0

        };

        //--------------------------------------------------
        // No Trend / No Pullback
        //--------------------------------------------------

        if (

            trend.direction === "NONE" ||

            pullback.level === "NONE"

        ) {

            return {

                playbook: "Trend Continuation",

                qualified: false,

                trend,

                pullback,

                confirmation,

                risk: defaultRisk,

                score: 0

            };

        }

        //--------------------------------------------------
        // Risk
        //--------------------------------------------------

        const risk =
            confirmation.confirmed

                ? this.risk.evaluate(

                    candles,

                    trend,

                    confirmation

                )

                : defaultRisk;

        //--------------------------------------------------
        // Score
        //--------------------------------------------------

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

        //--------------------------------------------------
        // Final
        //--------------------------------------------------

        return {

            playbook: "Trend Continuation",

            qualified:
                confirmation.confirmed,

            trend,

            pullback,

            confirmation,

            risk,

            score

        };

    }

}