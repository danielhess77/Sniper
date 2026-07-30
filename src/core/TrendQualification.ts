/**
 * Sniper
 * Trend Qualification Engine
 *
 * Version: 0.2
 *
 * Trend + EMA + VWAP
 */

import { Candle } from "./BDKClient";

export type TrendDirection =
  | "BULLISH"
  | "BEARISH"
  | "NONE";

export interface TrendResult {
  direction: TrendDirection;
  ema9: number;
  ema20: number;
  ema50: number;
  vwap: number;
}

export class TrendQualification {

  evaluate(candles: Candle[]): TrendResult {

    if (candles.length < 50) {
      throw new Error("Need at least 50 candles.");
    }

    const closes = candles.map(c => c.close);

    const ema9 = this.calculateEMA(closes, 9);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);

    const vwap = this.calculateVWAP(candles);

    const lastPrice = closes[closes.length - 1];

    let direction: TrendDirection = "NONE";

    if (
      lastPrice > vwap &&
      lastPrice > ema9 &&
      ema9 > ema20 &&
      ema20 > ema50
    ) {
      direction = "BULLISH";
    }

    if (
      lastPrice < vwap &&
      lastPrice < ema9 &&
      ema9 < ema20 &&
      ema20 < ema50
    ) {
      direction = "BEARISH";
    }

    return {
      direction,
      ema9,
      ema20,
      ema50,
      vwap
    };

  }

  private calculateEMA(
    values: number[],
    period: number
  ): number {

    const k = 2 / (period + 1);

    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema =
        values[i] * k +
        ema * (1 - k);
    }

    return Number(ema.toFixed(2));

  }

  private calculateVWAP(
    candles: Candle[]
  ): number {

    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (const candle of candles) {

      const typicalPrice =
        (candle.high + candle.low + candle.close) / 3;

      cumulativePV +=
        typicalPrice * candle.volume;

      cumulativeVolume +=
        candle.volume;

    }

    return Number(
      (cumulativePV / cumulativeVolume).toFixed(2)
    );

  }

}