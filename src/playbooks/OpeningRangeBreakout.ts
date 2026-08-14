/**
 * Sniper
 * Opening Range Breakout Playbook
 *
 * Version: 4.0 — lean stack
 *
 * - Signal only 10:00–11:00 ET (engine)
 * - Close outside OR + hold bar (engine)
 * - Min OR height (engine)
 * - Target = 1× OR height, capped at 1.5R; min R:R 1.0 for ORB only
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

        if (
            openingRange.direction !== "NONE" &&
            openingRange.breakoutIndex >= 0 &&
            openingRange.orHeight > 0
        ) {

            const entry =
                openingRange.breakoutPrice;

            const stop =

                openingRange.direction === "BULLISH"

                    ? openingRange.low

                    : openingRange.high;

            const riskDist =
                Math.max(Math.abs(entry - stop), 1e-6);

            // 1× OR height, capped at 1.5R from structural risk
            const move =
                Math.min(
                    openingRange.orHeight,
                    riskDist * 1.5
                );

            const target =

                openingRange.direction === "BULLISH"

                    ? entry + move

                    : entry - move;

            // ORB allows 1.0R minimum (not global 2.0)
            trade =
                this.risk.evaluateTrade(

                    entry,

                    stop,

                    target,

                    { minRiskReward: 1.0 }

                );

        }

        const structureOk =
            openingRange.direction !== "NONE" &&
            trade.valid &&
            trade.riskReward >= 1.0;

        // Require real hold structure; pattern confirm is a bonus not a bypass
        const qualified =
            structureOk;

        const score =
            this.score.evaluate({

                trend: 28,

                playbook: 28,

                confirmation:
                    confirmation.confirmed

                        ? confirmation.score

                        : structureOk

                            ? 14

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

        // Invalidate if price re-enters OR (failed breakout territory)
        if (

            result.openingRange.direction === "BULLISH" &&
            last.close < result.openingRange.high

        ) {

            return {

                active: false,

                reason: "Re-entered OR (failed hold)"

            };

        }

        if (

            result.openingRange.direction === "BEARISH" &&
            last.close > result.openingRange.low

        ) {

            return {

                active: false,

                reason: "Re-entered OR (failed hold)"

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

                ? "Qualified ORB (held breakout)"

                : "Setup not qualified"

        );

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.qualified

                ? "10:00–11:00 · hold bar · min OR · 1×OR target"

                : (result.openingRange.rejectReason ||
                    "Requirements not fully met")

        );

        return this.traceEngine.build();

    }

}
