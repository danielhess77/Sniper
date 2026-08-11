/**
 * Sniper
 * Risk Engine
 *
 * Version: 3.5
 *
 * If structure risk is tighter than min distance, widen the stop
 * (away from entry) to the floor — do not reject the trade.
 * If R:R is still below min after that, push target to minRR × risk.
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

export interface RiskLimits {

    minRiskReward?: number;

    minRiskDollars?: number;

    minRiskPct?: number;

}

export class RiskEngine {

    private static readonly MIN_RISK_REWARD = 1.5;

    /** Soft floor — tight structure is expanded to this, not killed */
    private static readonly MIN_RISK_DOLLARS = 0.25;

    private static readonly MIN_RISK_PCT = 0.0015; // 0.15%

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
    // Generic Trade Evaluation (0DTE + Swing)
    //--------------------------------------------------

    evaluateTrade(

        entry: number,

        stop: number,

        target: number,

        limits?: RiskLimits

    ): RiskResult {

        if (

            !Number.isFinite(entry) ||
            !Number.isFinite(stop) ||
            entry <= 0

        ) {

            return this.none();

        }

        const minRR =
            limits?.minRiskReward ?? RiskEngine.MIN_RISK_REWARD;

        const minRiskDollars =
            limits?.minRiskDollars ?? RiskEngine.MIN_RISK_DOLLARS;

        const minRiskPct =
            limits?.minRiskPct ?? RiskEngine.MIN_RISK_PCT;

        const minRisk =
            Math.max(
                minRiskDollars,
                entry * minRiskPct
            );

        // Side: long if stop below entry, short if stop above
        const isLong = stop <= entry;

        let adjStop = stop;

        let risk = Math.abs(entry - adjStop);

        // C: widen stop away from entry until min risk is met
        if (risk < minRisk) {

            if (isLong) {

                adjStop = entry - minRisk;

            } else {

                adjStop = entry + minRisk;

            }

            risk = minRisk;

        }

        if (risk <= 0) {

            return this.none();

        }

        let adjTarget = target;

        let reward = Math.abs(adjTarget - entry);

        // If target missing/wrong side/too close, place at minRR
        const targetOnWrongSide =
            isLong ? adjTarget <= entry : adjTarget >= entry;

        if (targetOnWrongSide || reward / risk < minRR) {

            if (isLong) {

                adjTarget = entry + risk * minRR;

            } else {

                adjTarget = entry - risk * minRR;

            }

            reward = risk * minRR;

        }

        const riskReward = reward / risk;

        if (riskReward < minRR - 1e-9) {

            return this.none();

        }

        return {

            valid: true,

            entry,

            stop: adjStop,

            target: adjTarget,

            riskReward

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

                : "Invalid (no usable entry/stop)"

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

                ? "Trade geometry valid (stop/target expanded to floors if needed)"

                : "Failed geometry"

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
