/**
 * Sniper
 * First Pullback Playbook
 *
 * Version: 1.1
 */

import { Candle } from "../core/BDKClient.js";
import { Playbook } from "./Playbook.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";

import {
    TrendQualification
} from "../core/TrendQualification.js";

import {
    PullbackEngine
} from "../engines/PullbackEngine.js";

import {
    ConfirmationEngine
} from "../engines/ConfirmationEngine.js";

import {
    RiskEngine
} from "../engines/RiskEngine.js";

type TrendResult =
    ReturnType<TrendQualification["evaluate"]>;

type PullbackResult =
    ReturnType<PullbackEngine["evaluate"]>;

type ConfirmationResult =
    ReturnType<ConfirmationEngine["evaluate"]>;

type RiskResult =
    ReturnType<RiskEngine["evaluate"]>;

export interface FirstPullbackResult {

    playbook: string;

    qualified: boolean;

    trend: TrendResult;

    pullback: PullbackResult;

    confirmation: ConfirmationResult;

    risk: RiskResult;

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

        const defaultRisk: RiskResult = {

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

        //--------------------------------------------------
        // Final
        //--------------------------------------------------

        return {

            playbook:
                "First Pullback",

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