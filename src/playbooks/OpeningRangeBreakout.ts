/**
 * Sniper
 * Opening Range Breakout Playbook
 *
 * Version: 3.1
 *
 * Decision Trace architecture.
 * Target now uses measured move of Opening Range height.
 */

import { Candle } from "../core/BDKClient.js";
import { OpeningRangeEngine } from "../engines/OpeningRangeEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

import {
    Playbook,
    ValidationResult
} from "./Playbook.js";

export interface OpeningRangeBreakoutResult {

    playbook: string;

    qualified: boolean;

    openingRange:
        ReturnType<OpeningRangeEngine["evaluate"]>;

    confirmation:
        ReturnType<ConfirmationEngine["evaluate"]>;

    trade:
        ReturnType<RiskEngine["evaluateTrade"]>;

    score: number;

}

export class OpeningRangeBreakout
implements Playbook<OpeningRangeBreakoutResult> {

    private openingRange =
        new OpeningRangeEngine();

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
    ): OpeningRangeBreakoutResult {

        const openingRange =
            this.openingRange.evaluate(candles);

        const confirmation =
            this.confirmation.evaluate(

                candles,

                openingRange.breakoutIndex

            );

        let trade =
            this.risk.evaluateTrade(

                0,

                0,

                0

            );

        if (

            openingRange.direction !== "NONE" &&
            confirmation.confirmed

        ) {

            const entry =
                openingRange.breakoutPrice;

            const stop =

                openingRange.direction === "BULLISH"

                    ? openingRange.low

                    : openingRange.high;

            // Measured Move = height of the Opening Range
            const rangeHeight =
                openingRange.high - openingRange.low;

            const target =

                openingRange.direction === "BULLISH"

                    ? entry + rangeHeight

                    : entry - rangeHeight;

            trade =
                this.risk.evaluateTrade(

                    entry,

                    stop,

                    target

                );

        }

        const score =
            this.score.evaluate({

                trend: 30,

                playbook: 25,

                confirmation:
                    confirmation.score,

                risk:
                    this.score.evaluateRisk(
                        trade.riskReward
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
                "Opening Range Breakout",

            qualified:
                trade.valid &&
                confirmation.confirmed,

            openingRange,

            confirmation,

            trade,

            score

        };

    }

    validate(

        candles: Candle[],

        result: OpeningRangeBreakoutResult

    ): ValidationResult {

        if (!result.qualified) {

            return {

                active: false,

                reason: "Not Qualified"

            };

        }

        const last =
            candles[candles.length - 1];

        if (

            result.openingRange.direction === "BULLISH" &&
            last.close < result.openingRange.high

        ) {

            return {

                active: false,

                reason:
                    "Returned Inside Opening Range"

            };

        }

        if (

            result.openingRange.direction === "BEARISH" &&
            last.close > result.openingRange.low

        ) {

            return {

                active: false,

                reason:
                    "Returned Inside Opening Range"

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
        result: OpeningRangeBreakoutResult
    ): DecisionTrace {

        this.traceEngine.reset();

        //--------------------------------------------------
        // Merge Engine Traces
        //--------------------------------------------------

        this.traceEngine.addSteps(

            this.openingRange.trace(
                result.openingRange
            )

        );

        this.traceEngine.addSteps(

            this.confirmation.trace(
                result.confirmation
            )

        );

        this.traceEngine.addSteps(

            this.risk.trace(
                result.trade
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

                ? "Opening Range Breakout confirmed"

                : "Requirements not fully met"

        );

        //--------------------------------------------------
        // Final Trace
        //--------------------------------------------------

        return this.traceEngine.build();

    }

}
