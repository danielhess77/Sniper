/**
 * Sniper
 * Opening Drive Engine
 *
 * Version: 1.0
 *
 * 1) Session open (optional gap vs last pre-session print)
 * 2) Directional drive in first 15 minutes
 * 3) Hold: price stays on the right side of the drive structure
 *
 * Confirms after the drive window (typically 9:45+ ET).
 */

import { Candle } from "../core/BDKClient.js";
import { MarketSession } from "../utils/MarketSession.js";
import { DecisionStep } from "../types/DecisionTrace.js";
import { DecisionTraceEngine } from "./DecisionTraceEngine.js";

export interface OpeningDriveResult {

    direction: "BULLISH" | "BEARISH" | "NONE";

    openPrice: number;

    priorClose: number;

    gapPct: number;

    driveHigh: number;

    driveLow: number;

    driveHeight: number;

    /** Structure level that must hold */
    holdLevel: number;

    confirmIndex: number;

    confirmPrice: number;

    reason: string;

}

export class OpeningDriveEngine {

    /** Drive measured over first N session minutes */
    private static readonly DRIVE_MINUTES = 15;

    /** Minimum |gap| to count as a gap drive (0.25%) */
    private static readonly MIN_GAP_PCT = 0.0025;

    /** Or strong open bar body vs range */
    private static readonly MIN_OPEN_BODY_FRAC = 0.55;

    private traceEngine =
        new DecisionTraceEngine();

    evaluate(

        candles: Candle[]

    ): OpeningDriveResult {

        const session =
            MarketSession.getRegularSession(candles);

        if (session.length < 10) {

            return this.none("Insufficient regular-session bars");

        }

        // Prior print: last candle before RTH if extended data present
        const firstSessionDt =
            session[0].datetime;

        const pre =
            candles.filter(c => c.datetime < firstSessionDt);

        const priorClose =
            pre.length > 0

                ? pre[pre.length - 1].close

                : session[0].open;

        const openPrice =
            session[0].open;

        const gapPct =
            priorClose > 0

                ? (openPrice - priorClose) / priorClose

                : 0;

        const driveBars =
            session.filter(c =>

                MarketSession.getSessionMinute(c) >= 0 &&

                MarketSession.getSessionMinute(c) <
                    OpeningDriveEngine.DRIVE_MINUTES

            );

        if (driveBars.length < 3) {

            return this.none("Drive window not complete");

        }

        const driveHigh =
            Math.max(...driveBars.map(c => c.high));

        const driveLow =
            Math.min(...driveBars.map(c => c.low));

        const driveHeight =
            driveHigh - driveLow;

        if (driveHeight <= 0) {

            return this.none("Zero drive height");

        }

        const openBar =
            driveBars[0];

        const openRange =
            openBar.high - openBar.low;

        const openBody =
            Math.abs(openBar.close - openBar.open);

        const strongOpenBull =
            openRange > 0 &&
            openBar.close > openBar.open &&
            openBody / openRange >= OpeningDriveEngine.MIN_OPEN_BODY_FRAC;

        const strongOpenBear =
            openRange > 0 &&
            openBar.close < openBar.open &&
            openBody / openRange >= OpeningDriveEngine.MIN_OPEN_BODY_FRAC;

        const gapBull =
            gapPct >= OpeningDriveEngine.MIN_GAP_PCT;

        const gapBear =
            gapPct <= -OpeningDriveEngine.MIN_GAP_PCT;

        // Net drive direction: where did the window close vs open
        const driveClose =
            driveBars[driveBars.length - 1].close;

        const driveBullish =
            driveClose > openPrice &&
            (gapBull || strongOpenBull || driveClose >= openPrice + driveHeight * 0.35);

        const driveBearish =
            driveClose < openPrice &&
            (gapBear || strongOpenBear || driveClose <= openPrice - driveHeight * 0.35);

        if (!driveBullish && !driveBearish) {

            return {

                direction: "NONE",

                openPrice,

                priorClose,

                gapPct,

                driveHigh,

                driveLow,

                driveHeight,

                holdLevel: 0,

                confirmIndex: -1,

                confirmPrice: 0,

                reason: "No clear opening drive"

            };

        }

        const direction: "BULLISH" | "BEARISH" =
            driveBullish ? "BULLISH" : "BEARISH";

        // Hold level: structural edge of the drive
        const holdLevel =
            direction === "BULLISH"

                ? Math.max(openPrice, driveLow)

                : Math.min(openPrice, driveHigh);

        // Find first post-drive bar that still holds structure
        // Map driveBars last back to full candles index
        const lastDrive =
            driveBars[driveBars.length - 1];

        let driveEndIndex =
            candles.findIndex(c => c.datetime === lastDrive.datetime);

        if (driveEndIndex < 0) {

            // fallback: search by session
            driveEndIndex = candles.indexOf(lastDrive as Candle);

        }

        if (driveEndIndex < 0) {

            return this.none("Could not locate drive end");

        }

        for (let i = driveEndIndex + 1; i < candles.length; i++) {

            const c = candles[i];

            if (!MarketSession.isRegularSession(c)) continue;

            if (direction === "BULLISH") {

                // Failed hold if close breaks under hold level
                if (c.close < holdLevel) {

                    return {

                        direction: "NONE",

                        openPrice,

                        priorClose,

                        gapPct,

                        driveHigh,

                        driveLow,

                        driveHeight,

                        holdLevel,

                        confirmIndex: -1,

                        confirmPrice: 0,

                        reason: "Drive failed — lost hold level"

                    };

                }

                // Confirm hold: still above hold, preferably not weak
                if (c.close >= holdLevel && c.low >= driveLow * 0.998) {

                    return {

                        direction: "BULLISH",

                        openPrice,

                        priorClose,

                        gapPct,

                        driveHigh,

                        driveLow,

                        driveHeight,

                        holdLevel,

                        confirmIndex: i,

                        confirmPrice: c.close,

                        reason:
                            gapBull

                                ? "Gap-up drive holding"

                                : "Opening drive holding above structure"

                    };

                }

            } else {

                if (c.close > holdLevel) {

                    return {

                        direction: "NONE",

                        openPrice,

                        priorClose,

                        gapPct,

                        driveHigh,

                        driveLow,

                        driveHeight,

                        holdLevel,

                        confirmIndex: -1,

                        confirmPrice: 0,

                        reason: "Drive failed — lost hold level"

                    };

                }

                if (c.close <= holdLevel && c.high <= driveHigh * 1.002) {

                    return {

                        direction: "BEARISH",

                        openPrice,

                        priorClose,

                        gapPct,

                        driveHigh,

                        driveLow,

                        driveHeight,

                        holdLevel,

                        confirmIndex: i,

                        confirmPrice: c.close,

                        reason:
                            gapBear

                                ? "Gap-down drive holding"

                                : "Opening drive holding below structure"

                    };

                }

            }

        }

        // Drive complete but no post-drive bar yet (still inside first 15m scan)
        return {

            direction: "NONE",

            openPrice,

            priorClose,

            gapPct,

            driveHigh,

            driveLow,

            driveHeight,

            holdLevel,

            confirmIndex: -1,

            confirmPrice: 0,

            reason: "Waiting for post-drive hold confirmation"

        };

    }

    trace(

        result: OpeningDriveResult

    ): DecisionStep[] {

        this.traceEngine.reset();

        this.traceEngine.add(

            "Opening Drive",

            result.direction !== "NONE",

            result.direction,

            result.reason

        );

        this.traceEngine.addInfo(

            "Gap",

            `${(result.gapPct * 100).toFixed(2)}%`,

            `Open ${result.openPrice.toFixed(2)} vs prior ${result.priorClose.toFixed(2)}`

        );

        this.traceEngine.addInfo(

            "Drive Range",

            `${result.driveLow.toFixed(2)} → ${result.driveHigh.toFixed(2)}`,

            `Height ${result.driveHeight.toFixed(2)}`

        );

        this.traceEngine.addInfo(

            "Hold Level",

            result.holdLevel

                ? result.holdLevel.toFixed(2)

                : "—",

            "Structure that must hold"

        );

        this.traceEngine.addInfo(

            "Confirm",

            result.confirmIndex >= 0

                ? `Index ${result.confirmIndex}`

                : "None",

            result.confirmPrice

                ? `Close ${result.confirmPrice.toFixed(2)}`

                : "No hold yet"

        );

        return this.traceEngine.build().steps;

    }

    private none(

        reason: string

    ): OpeningDriveResult {

        return {

            direction: "NONE",

            openPrice: 0,

            priorClose: 0,

            gapPct: 0,

            driveHigh: 0,

            driveLow: 0,

            driveHeight: 0,

            holdLevel: 0,

            confirmIndex: -1,

            confirmPrice: 0,

            reason

        };

    }

}
