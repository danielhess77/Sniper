/**
 * Sniper UI API
 *
 * Fetches live scan, swing, RVOL, and watchlist from the Sniper backend.
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

export interface SwingCard {

    symbol: string;

    horizon: string;

    horizonId: "SHORT" | "INTERMEDIATE" | string;

    state: string;

    qualified: boolean;

    score: number;

    direction: "BULLISH" | "NONE" | string;

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

    rsRank: number;

    rs: number;

    reason: string;

}

export interface SwingResponse {

    success: boolean;

    timestamp: string;

    watchlist: number;

    total: number;

    qualified: number;

    watching: number;

    results: SwingCard[];

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

export interface WatchlistResponse {

    success: boolean;

    timestamp: string;

    count: number;

    symbols: string[];

    error?: string;

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

export async function getSwing(): Promise<SwingResponse> {

    const response =
        await fetch(`${API}/swing`);

    if (!response.ok) {

        throw new Error(

            "Unable to reach Swing endpoint"

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

export async function getWatchlist(): Promise<WatchlistResponse> {

    const response =
        await fetch(`${API}/watchlist`);

    if (!response.ok) {

        throw new Error(

            "Unable to reach Watchlist endpoint"

        );

    }

    return response.json();

}

export async function putWatchlist(

    symbols: string[]

): Promise<WatchlistResponse> {

    const response =
        await fetch(`${API}/watchlist`, {

            method: "PUT",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({ symbols })

        });

    const data =
        await response.json() as WatchlistResponse;

    if (!response.ok) {

        throw new Error(

            data.error || "Failed to save watchlist"

        );

    }

    return data;

}
