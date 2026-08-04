/**
 * Sniper
 * Risk Engine
 *
 * Version: 5.0
 *
 * Calculates:
 * - Entry
 * - Stop
 * - Target
 * - Risk / Reward
 *
 * Target selection is delegated
 * to TargetEngine.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";
import { ConfirmationResult } from "./ConfirmationEngine.js";
import {
    TargetEngine,
    TargetSource
} from "./TargetEngine.js";

import {
    DecisionStep
} from "../types/DecisionTrace.js";

import {
    DecisionTraceEngine
} from "./DecisionTraceEngine.js";

export interface RiskResult {

    valid: boolean;

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

    targetSource: TargetSource;

}

export class RiskEngine {

    private static readonly MIN_RISK_REWARD = 1.75;

    private traceEngine =
        new DecisionTraceEngine();

    private targetEngine =
        new TargetEngine();

    //--------------------------------------------------
    // Trend Playbooks
    //--------------------------------------------------

    evaluate(

        candles: Candle[],

        trend: TrendResult,

        confirmation: ConfirmationResult

    ): RiskResult {

        if (

            candles.length < 20 ||

            trend.direction === "NONE" ||

            confirmation.candleIndex < 0

        ) {

            return this.none();

        }

        const signal =
            candles[confirmation.candleIndex];

        const entry =
            signal.close;

        //--------------------------------------------------
        // Stop Window
        //--------------------------------------------------

        const stopWindow =
            candles.slice(

                Math.max(
                    0,
                    confirmation.candleIndex - 4
                ),

                confirmation.candleIndex + 1

            );

        let stop = 0;

        if (trend.direction === "BULLISH") {

            stop = Math.min(

                signal.low,

                ...stopWindow.map(
                    c => c.low
                )

            );

        }

        else {

            stop = Math.max(

                signal.high,

                ...stopWindow.map(
                    c => c.high
                )

            );

        }

        //--------------------------------------------------
        // Target Engine
        //--------------------------------------------------

        const target =
            this.targetEngine.evaluate(

                candles,

                trend,

                entry

            );

        if (!target.valid) {

            return this.none();

        }

        return this.evaluateTrade(

            entry,

            stop,

            target.target,

            target.source

        );

    }

    //--------------------------------------------------
    // Generic Trade Evaluation
    //--------------------------------------------------

        evaluateTrade(

        entry: number,

        stop: number,

        target: number,

        targetSource: TargetSource = "NONE"

        ): RiskResult {

        const risk =
            Math.abs(entry - stop);

        const reward =
            Math.abs(target - entry);

        const riskReward =
        reward / risk;

        if (

        risk <= 0 ||

        reward <= 0 ||

        riskReward < RiskEngine.MIN_RISK_REWARD

) {

    return this.none();

}

        return {

        valid: true,

        entry,

        stop,

        target,

        riskReward,

        targetSource

    };

    }

        //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: RiskResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        //--------------------------------------------------
        // Risk
        //--------------------------------------------------

        this.traceEngine.add(

            "Risk",

            result.valid,

            `${result.riskReward.toFixed(2)}R`,

            result.valid

                ? "Trade geometry valid"

                : "Invalid trade geometry"

        );

        //--------------------------------------------------
        // Entry
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Entry",

            result.entry.toFixed(2),

            "Confirmation candle close"

        );

        //--------------------------------------------------
        // Stop
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Stop",

            result.stop.toFixed(2),

            "Structure stop"

        );

        //--------------------------------------------------
        // Target
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Target",

            result.target.toFixed(2),

            result.targetSource
                .replace("_", " ")
                .replace("_", " ")

        );

        //--------------------------------------------------
        // Expected Reward
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Reward",

            `${Math.abs(
                result.target -
                result.entry
            ).toFixed(2)}`,

            "Expected move"

        );

        //--------------------------------------------------
        // Risk / Reward
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Risk / Reward",

            `${result.riskReward.toFixed(2)}R`,

            "Calculated"

        );

        return this.traceEngine
            .build()
            .steps;

    }

    //--------------------------------------------------
    // Empty Result
    //--------------------------------------------------

    private none(): RiskResult {

        return {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0,

            targetSource: "NONE"

        };

    }

}