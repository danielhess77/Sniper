/**
 * Sniper
 * Opening Drive + Hold Playbook
 *
 * Version: 1.2 — target 2.1× risk for min R:R 2.0
 */

import { Candle } from "../core/BDKClient.js";
import { OpeningDriveEngine } from "../engines/OpeningDriveEngine.js";
import { ConfirmationEngine } from "../engines/ConfirmationEngine.js";
import { RiskEngine } from "../engines/RiskEngine.js";
import { ScoreEngine } from "../engines/ScoreEngine.js";
import { DecisionTrace } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "../engines/DecisionTraceEngine.js";

import {
    Playbook,
    ValidationResult
} from "./Playbook.js";

export interface OpeningDriveHoldResult {

    playbook: string;

    qualified: boolean;

    openingRange: {

        direction: "BULLISH" | "BEARISH" | "NONE";

        confirmIndex: number;

    };

    drive: ReturnType<OpeningDriveEngine["evaluate"]>;

    confirmation: ReturnType<ConfirmationEngine["evaluate"]>;

    trade: ReturnType<RiskEngine["evaluateTrade"]>;

    score: number;

}

export class OpeningDriveHold
    implements Playbook<OpeningDriveHoldResult> {

    private driveEngine =
        new OpeningDriveEngine();

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

    ): OpeningDriveHoldResult {

        const drive =
            this.driveEngine.evaluate(candles);

        const confirmation =
            this.confirmation.evaluate(

                candles,

                drive.confirmIndex >= 0

                    ? drive.confirmIndex

                    : 0

            );

        let trade =
            this.risk.evaluateTrade(0, 0, 0);

        if (

            drive.direction !== "NONE" &&
            drive.confirmIndex >= 0 &&
            drive.driveHeight > 0

        ) {

            const entry =
                drive.confirmPrice;

            const buffer =
                Math.max(drive.driveHeight * 0.05, entry * 0.001);

            let stop: number;

            if (drive.direction === "BULLISH") {

                stop =
                    drive.driveLow - buffer;

            } else {

                stop =
                    drive.driveHigh + buffer;

            }

            const riskDist =
                Math.abs(entry - stop);

            const target =

                drive.direction === "BULLISH"

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
            drive.direction !== "NONE" &&
            trade.valid;

        const qualified =
            structureOk &&
            (confirmation.confirmed || trade.riskReward >= 2.0);

        const gapBonus =
            Math.abs(drive.gapPct) >= 0.005 ? 5 : 0;

        const score =
            this.score.evaluate({

                trend: 28 + gapBonus,

                playbook: 28,

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
                    drive.confirmIndex >= 0

                        ? this.score.evaluateEntry(

                            Math.max(

                                0,

                                candles.length - 1 -

                                drive.confirmIndex

                            )

                        )

                        : 0

            });

        return {

            playbook:
                "Opening Drive Hold",

            qualified,

            openingRange: {

                direction: drive.direction,

                confirmIndex: drive.confirmIndex

            },

            drive,

            confirmation,

            trade,

            score

        };

    }

    validate(

        candles: Candle[],

        result: OpeningDriveHoldResult

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

            result.drive.direction === "BULLISH" &&
            last.close < result.trade.stop

        ) {

            return {

                active: false,

                reason: "Past stop"

            };

        }

        if (

            result.drive.direction === "BEARISH" &&
            last.close > result.trade.stop

        ) {

            return {

                active: false,

                reason: "Past stop"

            };

        }

        return {

            active: true,

            reason: ""

        };

    }

    trace(

        result: OpeningDriveHoldResult

    ): DecisionTrace {

        this.traceEngine.reset();

        this.traceEngine.addSteps(

            this.driveEngine.trace(result.drive)

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

                ? "Qualified opening drive hold"

                : "Not qualified"

        );

        this.traceEngine.addInfo(

            "Playbook",

            result.playbook,

            result.qualified

                ? "Drive + hold ready"

                : "Requirements not met"

        );

        return this.traceEngine.build();

    }

}
