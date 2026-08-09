/**
 * Shared Sniper Types
 */

export interface OptionSuggestion {

    ok: boolean;

    side: "CALL" | "PUT";

    symbol: string;

    description: string;

    strike: number;

    expiration: string;

    dte: number;

    bid: number;

    ask: number;

    mid: number;

    spreadPct: number;

    delta: number;

    openInterest: number;

    volume: number;

    reason: string;

}

export interface ScanCard {

    symbol: string;

    playbook: string;

    /** Display time of signal candle (ET) */
    triggerTime: string;

    /** ISO timestamp when structure became valid (signal candle) */
    qualifiedAt: string | null;

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

    option?: OptionSuggestion | null;

}
