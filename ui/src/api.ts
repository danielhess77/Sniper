/**
 * Sniper UI API
 *
 * Fetches live scan results
 * from the Sniper backend.
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

export interface ScanResponse {

    success: boolean;

    timestamp: string;

    watchlist: number;

    playbooks: number;

    total: number;

    qualified: number;

    results: ScanCard[];

}

const API = "/api";

export async function getScan(): Promise<ScanResponse> {

    const response =
        await fetch(`${API}/scan`);

    if (!response.ok) {

        throw new Error(

            "Unable to reach Sniper API"

        );

    }

    return response.json();

}