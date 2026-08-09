/**
 * Sniper
 * Failed Opening Range / Failed Breakout Playbook
 *
 * Version: 1.0
 *
 * Fade an OR breakout that reclaims back inside the range.
 * Stop beyond the post-breakout extreme.
 * Target = measured move of OR height in the fade direction.
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
                openingRange.high - openingRange.low;

            // Stop beyond the failed breakout extreme (small buffer)
            const buffer =
                rangeHeight * 0.05;

            let stop: number;

            let target: number;

            if (openingRange.direction === "BEARISH") {

                // Fade failed upside breakout → short/puts
                stop =
                    openingRange.excursionExtreme + buffer;

                target =
                    entry - rangeHeight;

            } else {

                // Fade failed downside breakout → long/calls
                stop =
                    openingRange.excursionExtreme - buffer;

                target =
                    entry + rangeHeight;

            }

            trade =
                this.risk.evaluateTrade(

                    entry,

                    stop,

                    target

                );

        }

        // Prefer candle confirmation but allow pure structure if RR is solid
        const structureOk =
            openingRange.direction !== "NONE" &&
            trade.valid;

        const qualified =
            structureOk &&
            (confirmation.confirmed || trade.riskReward >= 1.8);

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

        // Invalidate if price re-breaks the failed side with authority
        if (

            or.direction === "BEARISH" &&
            last.close > or.excursionExtreme

        ) {

            return {

                active: false,

                reason: "Re-broke above failed high"

            };

        }

        if (

            or.direction === "BULLISH" &&
            last.close < or.excursionExtreme

        ) {

            return {

                active: false,

                reason: "Re-broke below failed low"

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
