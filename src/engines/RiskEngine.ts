/**
 * Sniper
 * Risk Engine
 *
 * Version: 3.4
 *
 * Calculates:
 * - Entry
 * - Stop (structure)
 * - Target (Measured Move)
 * - Risk / Reward
 *
 * Enforces:
 * - Minimum R:R (default 1.5, overridable for swing horizons)
 * - Minimum risk distance (default $0.50 or 0.15%, overridable)
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

export interface RiskLimits {

    minRiskReward?: number;

    minRiskDollars?: number;

    minRiskPct?: number;

}

export class RiskEngine {

    private static readonly MIN_RISK_REWARD = 1.5;

    private static readonly MIN_RISK_DOLLARS = 0.50;

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

        const minRR =
            limits?.minRiskReward ?? RiskEngine.MIN_RISK_REWARD;

        const minRiskDollars =
            limits?.minRiskDollars ?? RiskEngine.MIN_RISK_DOLLARS;

        const minRiskPct =
            limits?.minRiskPct ?? RiskEngine.MIN_RISK_PCT;

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

        const minRisk =
            Math.max(
                minRiskDollars,
                entry * minRiskPct
            );

        if (risk < minRisk) {

            return this.none();

        }

        const riskReward =
            reward / risk;

        if (riskReward < minRR) {

            return this.none();

        }

        return {

            valid: true,

            entry,

            stop,

            target,

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

                : "Invalid (min R:R and min risk distance required)"

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

                ? "Trade geometry valid"

                : "Failed min R:R or min risk distance"

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
