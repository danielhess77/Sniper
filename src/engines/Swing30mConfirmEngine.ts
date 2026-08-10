/**
 * Sniper
 * Swing 30-minute Confirmation Engine
 *
 * Version: 1.0
 *
 * Daily structure qualifies the name; 30m confirms entry timing
 * for SHORT (1–3 day) horizon only.
 *
 * Confirmed when:
 *  - Last 30m close is at/above entry (small tolerance)
 *  - Last 30m low held above stop
 *  - Optional reclaim: traded below entry then closed back above
 */

import { Candle } from "../core/BDKClient.js";

export type ConfirmStatus = "confirmed" | "pending" | "n/a";

export interface Swing30mConfirmResult {

    status: ConfirmStatus;

    reason: string;

    lastClose: number;

    lastLow: number;

    bars: number;

}

export class Swing30mConfirmEngine {

    evaluate(

        candles30: Candle[],

        entry: number,

        stop: number,

        direction: "BULLISH" | "NONE" | string

    ): Swing30mConfirmResult {

        if (direction !== "BULLISH" || !(entry > 0) || !(stop > 0)) {

            return {

                status: "n/a",

                reason: "Confirm only for bullish setups with entry/stop",

                lastClose: 0,

                lastLow: 0,

                bars: candles30.length

            };

        }

        if (candles30.length < 8) {

            return {

                status: "pending",

                reason: "Insufficient 30m bars for confirm",

                lastClose: 0,

                lastLow: 0,

                bars: candles30.length

            };

        }

        const last = candles30[candles30.length - 1];

        const lastClose = last.close;

        const lastLow = last.low;

        // 0.15% tolerance above/below entry for “at entry”
        const eps = entry * 0.0015;

        const atOrAboveEntry = lastClose >= entry - eps;

        const heldAboveStop = lastLow > stop;

        // Reclaim: any of last 12 bars traded below entry, then last close back above
        const lookback = candles30.slice(-12);

        const taggedBelow = lookback.some(c => c.low < entry - eps);

        const reclaim =
            taggedBelow && lastClose >= entry - eps;

        if (atOrAboveEntry && heldAboveStop) {

            return {

                status: "confirmed",

                reason: reclaim

                    ? "30m reclaim of entry — held above stop"

                    : "30m close at/above entry — held above stop",

                lastClose,

                lastLow,

                bars: candles30.length

            };

        }

        if (!heldAboveStop) {

            return {

                status: "pending",

                reason: `30m low under stop (${lastLow.toFixed(2)} ≤ ${stop.toFixed(2)})`,

                lastClose,

                lastLow,

                bars: candles30.length

            };

        }

        return {

            status: "pending",

            reason: `30m waiting — close ${lastClose.toFixed(2)} vs entry ${entry.toFixed(2)}`,

            lastClose,

            lastLow,

            bars: candles30.length

        };

    }

}
