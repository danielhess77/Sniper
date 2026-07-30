/**
 * Sniper
 * Trend Continuation Playbook
 *
 * Version: 0.6
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";
import { PullbackEngine } from "../engines/PullbackEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";

export class TrendContinuation {

    private trend = new TrendQualification();

    private pullback = new PullbackEngine();

    private confirmation = new ConfirmationEngine();

    private risk = new RiskEngine();

    evaluate(candles: Candle[]) {

        const trend = this.trend.evaluate(candles);

        const pullback = this.pullback.evaluate(
            candles,
            trend
        );

        const confirmation = this.confirmation.evaluate(
            candles
        );

        let risk = {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

        if (

            trend.direction !== "NONE" &&
            pullback.level !== "NONE" &&
            confirmation.confirmed

        ) {

            risk = this.risk.evaluate(
                candles,
                trend,
                confirmation
            );

        }

        return {

            playbook: "Trend Continuation",

            qualified: risk.valid,

            trend,

            pullback,

            confirmation,

            risk

        };

    }

}