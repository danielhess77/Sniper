/**
 * Sniper
 * Swing Horizon Config
 *
 * Version: 1.0
 *
 * Locked parameters for Short (1–3 day) and Intermediate (1–3 week) swings.
 */

export type SwingHorizonId = "SHORT" | "INTERMEDIATE";

export interface SwingHorizonConfig {

    id: SwingHorizonId;

    label: string;

    /** RS lookback in trading sessions */
    rsLookback: number;

    /** Minimum R:R required */
    minRiskReward: number;

    /** Absolute min risk in dollars */
    minRiskDollars: number;

    /** Min risk as fraction of price (e.g. 0.0015 = 0.15%) */
    minRiskPct: number;

    /** Require soft 50 EMA filter */
    useSoft50Filter: boolean;

    /** EMA period for primary trend */
    trendEmaPeriod: number;

}

export const SWING_SHORT: SwingHorizonConfig = {

    id: "SHORT",

    label: "Short Swing (1–3 day)",

    rsLookback: 10,

    minRiskReward: 1.5,

    minRiskDollars: 0.50,

    minRiskPct: 0.0015,

    useSoft50Filter: false,

    trendEmaPeriod: 20

};

export const SWING_INTERMEDIATE: SwingHorizonConfig = {

    id: "INTERMEDIATE",

    label: "Intermediate Swing (1–3 week)",

    rsLookback: 20,

    minRiskReward: 1.8,

    minRiskDollars: 0.75,

    minRiskPct: 0.0025,

    useSoft50Filter: true,

    trendEmaPeriod: 20

};

export const SWING_HORIZONS: SwingHorizonConfig[] = [

    SWING_SHORT,

    SWING_INTERMEDIATE

];
