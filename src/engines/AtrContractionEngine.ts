/**
 * Sniper
 * ATR Contraction Engine
 *
 * Version: 1.0
 *
 * Quality gate for breakouts: short-term ATR below long-term ATR
 * means volatility is coiling (higher-quality expansion setups).
 */

import { Candle } from "../core/BDKClient.js";

export interface AtrContractionResult {

    /** true when short ATR < long ATR */
    contracting: boolean;

    shortAtr: number;

    longAtr: number;

    /** short / long (1.0 = equal; &lt; 1 = contraction) */
    ratio: number;

    shortPeriod: number;

    longPeriod: number;

    reason: string;

}

export class AtrContractionEngine {

    static readonly SHORT_PERIOD = 7;

    static readonly LONG_PERIOD = 20;

    evaluate(

        candles: Candle[],

        shortPeriod = AtrContractionEngine.SHORT_PERIOD,

        longPeriod = AtrContractionEngine.LONG_PERIOD

    ): AtrContractionResult {

        const need = longPeriod + 2;

        if (candles.length < need) {

            return {

                contracting: false,

                shortAtr: 0,

                longAtr: 0,

                ratio: 0,

                shortPeriod,

                longPeriod,

                reason: `Need ≥${need} bars for ATR contraction`

            };

        }

        const shortAtr =
            this.wilderAtr(candles, shortPeriod);

        const longAtr =
            this.wilderAtr(candles, longPeriod);

        if (shortAtr <= 0 || longAtr <= 0) {

            return {

                contracting: false,

                shortAtr,

                longAtr,

                ratio: 0,

                shortPeriod,

                longPeriod,

                reason: "ATR unavailable"

            };

        }

        const ratio = shortAtr / longAtr;

        const contracting = shortAtr < longAtr;

        return {

            contracting,

            shortAtr,

            longAtr,

            ratio,

            shortPeriod,

            longPeriod,

            reason: contracting

                ? `ATR coil: ATR(${shortPeriod}) ${shortAtr.toFixed(2)} < ATR(${longPeriod}) ${longAtr.toFixed(2)} (${ratio.toFixed(2)}×)`

                : `No coil: ATR(${shortPeriod}) ${shortAtr.toFixed(2)} ≥ ATR(${longPeriod}) ${longAtr.toFixed(2)} (${ratio.toFixed(2)}×) — expansion already on`

        };

    }

    private wilderAtr(

        candles: Candle[],

        period: number

    ): number {

        if (candles.length < period + 1) return 0;

        const trs: number[] = [];

        for (let i = 1; i < candles.length; i++) {

            const c = candles[i];

            const prev = candles[i - 1];

            trs.push(

                Math.max(

                    c.high - c.low,

                    Math.abs(c.high - prev.close),

                    Math.abs(c.low - prev.close)

                )

            );

        }

        if (trs.length < period) return 0;

        let atr =
            trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < trs.length; i++) {

            atr = (atr * (period - 1) + trs[i]) / period;

        }

        return atr;

    }

}
