/**
 * Sniper
 * Risk Engine
 *
 * Version: 3.0
 *
 * Calculates:
 * - Entry
 * - Stop
 * - Target
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

    evaluate(

        candles: Candle[],

        trend: TrendResult,

        confirmation: ConfirmationResult

    ): RiskResult {

        //--------------------------------------------------
        // Basic Validation
        //--------------------------------------------------

        if (

            candles.length < 20 ||

            trend.direction === "NONE" ||

            confirmation.candleIndex < 0

        ) {

            return {

                valid: false,

                entry: 0,

                stop: 0,

                target: 0,

                riskReward: 0

            };

        }

        const signal =
            candles[confirmation.candleIndex];

        const entry =
            signal.close;

        //--------------------------------------------------
        // Structure Windows
        //--------------------------------------------------

        const stopWindow =
            candles.slice(

                Math.max(
                    0,
                    confirmation.candleIndex - 4
                ),

                confirmation.candleIndex + 1

            );

        const targetWindow =
            candles.slice(

                Math.max(
                    0,
                    confirmation.candleIndex - 19
                ),

                confirmation.candleIndex + 1

            );

        let stop = 0;
        let target = 0;

        //--------------------------------------------------
        // Bullish
        //--------------------------------------------------

        if (trend.direction === "BULLISH") {

            stop = Math.min(

                signal.low,

                ...stopWindow.map(
                    c => c.low
                )

            );

            target = Math.max(

                ...targetWindow.map(
                    c => c.high
                )

            );

        }

        //--------------------------------------------------
        // Bearish
        //--------------------------------------------------

        else {

            stop = Math.max(

                signal.high,

                ...stopWindow.map(
                    c => c.high
                )

            );

            target = Math.min(

                ...targetWindow.map(
                    c => c.low
                )

            );

        }

        //--------------------------------------------------
        // Geometry Validation
        //--------------------------------------------------

        let risk = 0;
        let reward = 0;

        if (trend.direction === "BULLISH") {

            risk =
                entry - stop;

            reward =
                target - entry;

        }

        else {

            risk =
                stop - entry;

            reward =
                entry - target;

        }

        if (

            risk <= 0 ||

            reward <= 0

        ) {

        return this.none();

        }

        //--------------------------------------------------
        // Final Result
        //--------------------------------------------------

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

        //--------------------------------------------------
        // Risk
        //--------------------------------------------------

        this.traceEngine.add(

            "Risk",

            result.valid,

            `${result.riskReward.toFixed(2)}R`,

            result.valid

                ? `Entry ${result.entry.toFixed(2)} | Stop ${result.stop.toFixed(2)} | Target ${result.target.toFixed(2)}`

                : "Invalid trade geometry"

        );

        //--------------------------------------------------
        // Trade
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Trade",

            `${result.entry.toFixed(2)} → ${result.target.toFixed(2)}`,

            `Stop ${result.stop.toFixed(2)}`

        );

        //--------------------------------------------------
        // Risk / Reward
        //--------------------------------------------------

        this.traceEngine.addInfo(

            "Risk / Reward",

            `${result.riskReward.toFixed(2)}R`,

            result.valid

                ? "Trade geometry valid"

                : "Trade geometry invalid"

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

            riskReward: 0

        };

    }

}