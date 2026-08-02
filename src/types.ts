/**
 * Shared Sniper Types
 */

export interface ScanCard {

    symbol: string;

    playbook: string;

    triggerTime: string;

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