/**
 * Sniper
 * Opening Range Breakout Playbook
 *
 * Version: 3.4 — target 2.1× risk for min R:R 2.0
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

                openingRange.breakoutIndex >= 0

                    ? openingRange.breakoutIndex

                    : 0

            );

        let trade =
            this.risk.evaluateTrade(0, 0, 0);

        if (openingRange.direction !== "NONE" && openingRange.breakoutIndex >= 0) {

            const entry =
                openingRange.breakoutPrice;

            const stop =

                openingRange.direction === "BULLISH"

                    ? openingRange.low

                    : openingRange.high;

            const riskDist =
                Math.abs(entry - stop);

            const target =

                openingRange.direction === "BULLISH"

                    ? entry + riskDist * 2.1

                    : entry - riskDist * 2.1;

            trade =
                this.risk.evaluateTrade(

                    entry,

                    stop,

                    target

                );

        }

        const structureOk =
            openingRange.direction !== "NONE" &&
            trade.valid;

        const qualified =
            structureOk &&
            (confirmation.confirmed || trade.riskReward >= 2.0);

        const score =
            this.score.evaluate({

                trend: 30,

                playbook: 25,

                confirmation:
                    confirmation.confirmed

                        ? confirmation.score

                        : structureOk

                            ? 12

                            : 0,

                risk:
                    this.score.evaluateRisk(
                        trade.riskReward
                    ),

                entry:
                    openingRange.breakoutIndex >= 0

                        ? this.score.evaluateEntry(

                            Math.max(
                                0,
                                candles.length - 1 -
                                openingRange.breakoutIndex
                            )

                        )

                        : 0

            });

        return {

            playbook:
                "Opening Range Breakout",

            qualified,

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
            last.close < result.openingRange.low

        ) {

            return {

                active: false,

                reason: "Broke OR low (stop side)"

            };

        }

        if (

            result.openingRange.direction === "BEARISH" &&
            last.close > result.openingRange.high

        ) {

            return {

                active: false,

                reason: "Broke OR high (stop side)"

            };

        }

        return {

            active: true,

            reason: ""

        };

    }

    trace(
        result: OpeningRangeBreakoutResult
    ): DecisionTrace {

        this.traceEngine.reset();

        this.traceEngine.addSteps(
            this.openingRange.trace(result.openingRange)
        );

        this.traceEngine.addSteps(
            this.confirmation.trace(result.confirmation)
        );

        this.traceEngine.addSteps(
            this.risk.trace(result.trade)
        );

        this.traceEngine.addInfo(

            "Score",

            `${result.score}/100`,

            result.qualified

                ? "Qualified setup"

                : "Setup not qualified"

        );

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.qualified

                ? "Opening Range Breakout"

                : "Requirements not fully met"

        );

        return this.traceEngine.build();

    }

}
