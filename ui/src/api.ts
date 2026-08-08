/**
 * Sniper UI API
 *
 * Fetches live scan results
 * and RVOL leaderboard from the Sniper backend.
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

export interface RvolCard {

    symbol: string;

    rvol: number;

    totalVolume: number;

    avg10DaysVolume: number;

    lastPrice: number;

    netPercentChange: number;

}

export interface RvolResponse {

    success: boolean;

    timestamp: string;

    sessionMinute: number;

    afterOpen30: boolean;

    cached: boolean;

    live: RvolCard[];

    opening30: RvolCard[] | null;

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

export async function getRvol(): Promise<RvolResponse> {

    const response =
        await fetch(`${API}/rvol`);

    if (!response.ok) {

        throw new Error(

            "Unable to reach RVOL endpoint"

        );

    }

    return response.json();

}
