/**
 * Sniper
 * Risk Engine
 *
 * Version: 3.1
 *
 * Calculates:
 * - Entry
 * - Stop (structure)
 * - Target (Measured Move)
 * - Risk / Reward
 *
 * Owns its own Decision Trace.
 */

import { Candle } from "../core/BDKClient.js";
import { TrendResult } from "../core/TrendQualification.js";
import { ConfirmationResult } from "./ConfirmationEngine.js";
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

}

export class RiskEngine {

    private traceEngine =
        new DecisionTraceEngine();

    //--------------------------------------------------
    // Structure-based stop + Measured Move target
    // Used by FirstPullback, TrendContinuation, VWAPReclaim
    //--------------------------------------------------

    evaluate(

        candles: Candle[],

        trend: TrendResult,

        confirmation: ConfirmationResult,

        measuredMoveSize?: number

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
        // Structure Stop (last 5 candles including signal)
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
                ...stopWindow.map(c => c.low)
            );

        } else {

            stop = Math.max(
                signal.high,
                ...stopWindow.map(c => c.high)
            );

        }

        //--------------------------------------------------
        // Measured Move Target
        //--------------------------------------------------

        // If caller did not supply a measured-move size,
        // fall back to a reasonable impulse proxy (12 candles before signal)
        let moveSize = measuredMoveSize;

        if (moveSize === undefined || moveSize <= 0) {

            const impulseWindow =
                candles.slice(

                    Math.max(0, confirmation.candleIndex - 12),

                    confirmation.candleIndex

                );

            if (impulseWindow.length < 3) {
                return this.none();
            }

            const impulseHigh = Math.max(...impulseWindow.map(c => c.high));
            const impulseLow  = Math.min(...impulseWindow.map(c => c.low));
            moveSize = impulseHigh - impulseLow;
        }

        if (moveSize <= 0) {
            return this.none();
        }

        let target = 0;

        if (trend.direction === "BULLISH") {
            target = entry + moveSize;
        } else {
            target = entry - moveSize;
        }

        return this.evaluateTrade(entry, stop, target);
    }

    //--------------------------------------------------
    // Generic Trade Evaluation (used by all playbooks)
    //--------------------------------------------------

    evaluateTrade(

        entry: number,

        stop: number,

        target: number

    ): RiskResult {

        const risk =
            Math.abs(entry - stop);

        const reward =
            Math.abs(target - entry);

        if (

            risk <= 0 ||

            reward <= 0

        ) {

            return this.none();

        }

        return {

            valid: true,

            entry,

            stop,

            target,

            riskReward:
                reward / risk

        };

    }

    //--------------------------------------------------
    // Decision Trace
    //--------------------------------------------------

    trace(
        result: RiskResult
    ): DecisionStep[] {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Risk",

            result.valid,

            `${result.riskReward.toFixed(2)}R`,

            result.valid

                ? `Entry ${result.entry.toFixed(2)} | Stop ${result.stop.toFixed(2)} | Target ${result.target.toFixed(2)}`

                : "Invalid trade geometry"

        );

        this.traceEngine.addInfo(

            "Trade",

            `${result.entry.toFixed(2)} → ${result.target.toFixed(2)}`,

            `Stop ${result.stop.toFixed(2)}`

        );

        this.traceEngine.addInfo(

            "Risk / Reward",

            `${result.riskReward.toFixed(2)}R`,

            result.valid

                ? "Trade geometry valid (Measured Move)"

                : "Trade geometry invalid"

        );

        return this.traceEngine
            .build()
            .steps;

    }

    private none(): RiskResult {

        return {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

    }

}
