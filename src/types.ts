/**
 * Sniper
 * Shared Types
 *
 * Every playbook is normalized into this shape
 * before being displayed in the UI or returned
 * by the API.
 */

export interface ScanCard {

    symbol: string;

    playbook: string;

    qualified: boolean;

    score: number;

    direction:
        | "BULLISH"
        | "BEARISH"
        | "NONE";

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

}