/**
 * Sniper
 * Failed Opening Range / Failed Breakout Playbook
 *
 * Version: 1.1
 *
 * Stop uses max(structural extreme buffer, 25% of OR height) so
 * min-risk distance can pass when the fail print is tight to the extreme.
 * Target = 1.6 × risk for min RR.
 */

import { Candle } from "../core/BDKClient.js";
import { FailedOpeningRangeEngine } from "../engines/FailedOpeningRangeEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

import {
    Playbook,
    ValidationResult
} from "./Playbook.js";

export interface FailedOpeningRangeBreakoutResult {

    playbook: string;

    qualified: boolean;

    openingRange:
        ReturnType<FailedOpeningRangeEngine["evaluate"]>;

    confirmation:
        ReturnType<ConfirmationEngine["evaluate"]>;

    trade:
        ReturnType<RiskEngine["evaluateTrade"]>;

    score: number;

}

export class FailedOpeningRangeBreakout
    implements Playbook<FailedOpeningRangeBreakoutResult> {

    private failedOr =
        new FailedOpeningRangeEngine();

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

    ): FailedOpeningRangeBreakoutResult {

        const openingRange =
            this.failedOr.evaluate(candles);

        const confirmation =
            this.confirmation.evaluate(

                candles,

                openingRange.failIndex >= 0

                    ? openingRange.failIndex

                    : 0

            );

        let trade =
            this.risk.evaluateTrade(0, 0, 0);

        if (

            openingRange.direction !== "NONE" &&
            openingRange.failIndex >= 0

        ) {

            const entry =
                openingRange.failPrice;

            const rangeHeight =
                Math.max(
                    openingRange.high - openingRange.low,
                    0.01
                );

            // Structural stop beyond excursion, but at least 25% of OR height
            const minStopDist =
                Math.max(rangeHeight * 0.25, entry * 0.0015, 0.50);

            let stop: number;

            if (openingRange.direction === "BEARISH") {

                // Fade failed upside breakout
                stop =
                    Math.max(

                        openingRange.excursionExtreme,

                        entry

                    ) + minStopDist;

            } else {

                stop =
                    Math.min(

                        openingRange.excursionExtreme,

                        entry

                    ) - minStopDist;

            }

            const riskDist =
                Math.abs(entry - stop);

            const target =

                openingRange.direction === "BEARISH"

                    ? entry - riskDist * 1.6

                    : entry + riskDist * 1.6;

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
            (confirmation.confirmed || trade.riskReward >= 1.5);

        const score =
            this.score.evaluate({

                trend: 25,

                playbook: 30,

                confirmation:
                    confirmation.confirmed

                        ? confirmation.score

                        : structureOk

                            ? 10

                            : 0,

                risk:
                    this.score.evaluateRisk(
                        trade.riskReward
                    ),

                entry:
                    openingRange.failIndex >= 0

                        ? this.score.evaluateEntry(

                            Math.max(

                                0,

                                candles.length - 1 -

                                openingRange.failIndex

                            )

                        )

                        : 0

            });

        return {

            playbook:
                "Failed Opening Range",

            qualified,

            openingRange,

            confirmation,

            trade,

            score

        };

    }

    validate(

        candles: Candle[],

        result: FailedOpeningRangeBreakoutResult

    ): ValidationResult {

        if (!result.qualified) {

            return {

                active: false,

                reason: "Not Qualified"

            };

        }

        const last =
            candles[candles.length - 1];

        const or = result.openingRange;

        if (

            or.direction === "BEARISH" &&
            last.close > result.trade.stop

        ) {

            return {

                active: false,

                reason: "Past stop (re-broke failed high)"

            };

        }

        if (

            or.direction === "BULLISH" &&
            last.close < result.trade.stop

        ) {

            return {

                active: false,

                reason: "Past stop (re-broke failed low)"

            };

        }

        return {

            active: true,

            reason: ""

        };

    }

    trace(

        result: FailedOpeningRangeBreakoutResult

    ): DecisionTrace {

        this.traceEngine.reset();

        this.traceEngine.addSteps(

            this.failedOr.trace(result.openingRange)

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

                ? "Qualified failed-OR fade"

                : "Not qualified"

        );

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.qualified

                ? "Failed breakout fade ready"

                : "Requirements not met"

        );

        return this.traceEngine.build();

    }

}
