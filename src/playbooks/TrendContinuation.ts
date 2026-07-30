/**
 * Sniper
 * Trend Continuation Playbook
 *
 * Version: 0.1
 */

import { Candle } from "../core/BDKClient.js";
import { TrendQualification } from "../core/TrendQualification.js";

export class TrendContinuation {

    private trend = new TrendQualification();

    evaluate(candles: Candle[]) {

        const trendResult = this.trend.evaluate(candles);

        return {

            playbook: "Trend Continuation",

            trend: trendResult,

            qualified:
                trendResult.direction !== "NONE"

        };

    }

}