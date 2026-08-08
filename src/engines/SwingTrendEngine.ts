/**
 * Sniper
 * Swing Trend Engine
 *
 * Version: 1.0
 *
 * Daily trend qualification for swing longs:
 * - Close > rising 20 EMA
 * - Optional soft 50 EMA filter (intermediate horizon)
 */

import { Candle } from "../core/BDKClient.js";
import { SwingHorizonConfig } from "../config/SwingHorizons.js";

export interface SwingTrendResult {

    valid: boolean;

    direction: "BULLISH" | "NONE";

    ema20: number;

    ema50: number;

    ema20Rising: boolean;

    aboveEma20: boolean;

    soft50Ok: boolean;

    reason: string;

}

export class SwingTrendEngine {

    evaluate(

        dailyCandles: Candle[],

        horizon: SwingHorizonConfig

    ): SwingTrendResult {

        const none = (

            reason: string

        ): SwingTrendResult => ({

            valid: false,

            direction: "NONE",

            ema20: 0,

            ema50: 0,

            ema20Rising: false,

            aboveEma20: false,

            soft50Ok: false,

            reason

        });

        if (dailyCandles.length < 60) {

            return none("Insufficient daily history");

        }

        const ema20Series =
            this.ema(dailyCandles.map(c => c.close), 20);

        const ema50Series =
            this.ema(dailyCandles.map(c => c.close), 50);

        const i = dailyCandles.length - 1;

        const close = dailyCandles[i].close;

        const ema20 = ema20Series[i];

        const ema50 = ema50Series[i];

        // Rising = current 20 EMA > value ~4 bars ago
        const lookback = 4;

        const ema20Rising =
            ema20 > ema20Series[i - lookback];

        const aboveEma20 =
            close > ema20;

        // Soft 50: price above 50 OR 50 not falling hard
        const ema50FlatOrRising =
            ema50 >= ema50Series[i - lookback] * 0.998;

        const soft50Ok =
            !horizon.useSoft50Filter ||
            close > ema50 ||
            ema50FlatOrRising;

        if (!aboveEma20) {

            return {

                valid: false,

                direction: "NONE",

                ema20,

                ema50,

                ema20Rising,

                aboveEma20,

                soft50Ok,

                reason: "Close below 20 EMA"

            };

        }

        if (!ema20Rising) {

            return {

                valid: false,

                direction: "NONE",

                ema20,

                ema50,

                ema20Rising,

                aboveEma20,

                soft50Ok,

                reason: "20 EMA not rising"

            };

        }

        if (!soft50Ok) {

            return {

                valid: false,

                direction: "NONE",

                ema20,

                ema50,

                ema20Rising,

                aboveEma20,

                soft50Ok,

                reason: "Failed soft 50 EMA filter"

            };

        }

        return {

            valid: true,

            direction: "BULLISH",

            ema20,

            ema50,

            ema20Rising,

            aboveEma20,

            soft50Ok,

            reason: "Trend intact"

        };

    }

    private ema(

        values: number[],

        period: number

    ): number[] {

        const out: number[] = [];

        const k = 2 / (period + 1);

        let prev = values[0];

        for (let i = 0; i < values.length; i++) {

            if (i === 0) {

                out.push(prev);

                continue;

            }

            if (i < period - 1) {

                // Seed with SMA until period filled
                const slice = values.slice(0, i + 1);

                const sma =
                    slice.reduce((a, b) => a + b, 0) / slice.length;

                prev = sma;

                out.push(sma);

                continue;

            }

            if (i === period - 1) {

                const slice = values.slice(0, period);

                prev =
                    slice.reduce((a, b) => a + b, 0) / period;

                out.push(prev);

                continue;

            }

            prev = values[i] * k + prev * (1 - k);

            out.push(prev);

        }

        return out;

    }

}
