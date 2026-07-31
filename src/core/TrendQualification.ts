/**
 * Sniper
 * Trend Qualification Engine
 *
 * Version: 0.4
 *
 * Trend + EMA + VWAP
 */

import { Candle } from "./BDKClient.js";

export type TrendDirection =
  | "BULLISH"
  | "BEARISH"
  | "NONE";

export interface TrendChecks {

  // Bullish
  priceAboveVWAP: boolean;
  priceAboveEMA9: boolean;
  ema9AboveEMA20: boolean;
  ema20AboveEMA50: boolean;

  // Bearish
  priceBelowVWAP: boolean;
  priceBelowEMA9: boolean;
  ema9BelowEMA20: boolean;
  ema20BelowEMA50: boolean;

}

export interface TrendResult {

  direction: TrendDirection;

  currentPrice: number;

  latestCandle: Candle;

  ema9: number;
  ema20: number;
  ema50: number;

  vwap: number;

  checks: TrendChecks;

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

    const latestCandle = candles[candles.length - 1];

    const currentPrice = latestCandle.close;

    const checks: TrendChecks = {

      // Bullish
      priceAboveVWAP: currentPrice > vwap,
      priceAboveEMA9: currentPrice > ema9,
      ema9AboveEMA20: ema9 > ema20,
      ema20AboveEMA50: ema20 > ema50,

      // Bearish
      priceBelowVWAP: currentPrice < vwap,
      priceBelowEMA9: currentPrice < ema9,
      ema9BelowEMA20: ema9 < ema20,
      ema20BelowEMA50: ema20 < ema50

    };

    let direction: TrendDirection = "NONE";

    if (
      checks.priceAboveVWAP &&
      checks.priceAboveEMA9 &&
      checks.ema9AboveEMA20 &&
      checks.ema20AboveEMA50
    ) {
      direction = "BULLISH";
    }
    else if (
      checks.priceBelowVWAP &&
      checks.priceBelowEMA9 &&
      checks.ema9BelowEMA20 &&
      checks.ema20BelowEMA50
    ) {
      direction = "BEARISH";
    }

    return {

      direction,

      currentPrice,

      latestCandle,

      ema9,
      ema20,
      ema50,

      vwap,

      checks

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