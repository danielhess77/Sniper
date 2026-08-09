/**
 * Sniper
 * Opening Drive + Hold Playbook
 *
 * Version: 1.0
 *
 * Gap / open drive in the first 15 minutes, then hold.
 * Stop beyond drive extreme; target = drive height measured move.
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

    /** Alias shape for ScanNormalizer direction */
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
                drive.driveHeight * 0.05;

            let stop: number;

            let target: number;

            if (drive.direction === "BULLISH") {

                stop =
                    drive.driveLow - buffer;

                target =
                    entry + drive.driveHeight;

            } else {

                stop =
                    drive.driveHigh + buffer;

                target =
                    entry - drive.driveHeight;

            }

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

        // Candle patterns help but structure + RR can stand alone
        const qualified =
            structureOk &&
            (confirmation.confirmed || trade.riskReward >= 1.6);

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

        const d = result.drive;

        if (

            d.direction === "BULLISH" &&
            last.close < d.holdLevel

        ) {

            return {

                active: false,

                reason: "Lost drive hold level"

            };

        }

        if (

            d.direction === "BEARISH" &&
            last.close > d.holdLevel

        ) {

            return {

                active: false,

                reason: "Lost drive hold level"

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
