/**
 * Sniper UI API
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
    triggerTime: string;
    /** ISO when structure became valid */
    qualifiedAt?: string | null;
    qualified: boolean;
    score: number;
    direction: "BULLISH" | "BEARISH" | "NONE";
    entry: number;
    stop: number;
    target: number;
    riskReward: number;
    option?: OptionSuggestion | null;
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
    setupType?: "PULLBACK" | "TIGHT_BASE" | string;
    /** Display date of trigger bar */
    triggerTime?: string;
    qualifiedAt?: string | null;
    option?: OptionSuggestion | null;
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
    mode?: "opening" | "day";
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

export type TakenStatus = "unknown" | "yes" | "no";

export interface JournalEntry {
    id: string;
    scope: "intraday" | "swing";
    symbol: string;
    playbook: string;
    setupType: string;
    horizonId: string;
    direction: string;
    entry: number;
    stop: number;
    target: number;
    riskReward: number;
    score: number;
    rsRank: number;
    sessionDate: string;
    loggedAt: string;
    taken: TakenStatus;
    outcome: "open" | "target" | "stop" | "expired" | "manual";
    rMultiple: number | null;
    resolvedAt: string | null;
    exitPrice: number | null;
    notes: string;
}

export interface JournalSummary {
    total: number;
    open: number;
    resolved: number;
    wins: number;
    losses: number;
    expired: number;
    winRate: number | null;
    avgR: number | null;
    expectancy: number | null;
    takenYes: number;
    takenResolved: number;
    takenWinRate: number | null;
    takenAvgR: number | null;
    takenExpectancy: number | null;
    byPlaybook: { playbook: string; n: number; wins: number; avgR: number | null }[];
}

export interface JournalResponse {
    success: boolean;
    timestamp: string;
    entries: JournalEntry[];
    summary: JournalSummary;
}

const API = "/api";

export async function getScan(): Promise<ScanResponse> {
    const response = await fetch(`${API}/scan`);
    if (!response.ok) throw new Error("Unable to reach Sniper API");
    return response.json();
}

export async function getSwing(): Promise<SwingResponse> {
    const response = await fetch(`${API}/swing`);
    if (!response.ok) throw new Error("Unable to reach Swing endpoint");
    return response.json();
}

export async function getRvol(): Promise<RvolResponse> {
    const response = await fetch(`${API}/rvol`);
    if (!response.ok) throw new Error("Unable to reach RVOL endpoint");
    return response.json();
}

export async function getWatchlist(): Promise<WatchlistResponse> {
    const response = await fetch(`${API}/watchlist`);
    if (!response.ok) throw new Error("Unable to reach Watchlist endpoint");
    return response.json();
}

export async function putWatchlist(symbols: string[]): Promise<WatchlistResponse> {
    const response = await fetch(`${API}/watchlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
    });
    const data = await response.json() as WatchlistResponse;
    if (!response.ok) throw new Error(data.error || "Failed to save watchlist");
    return data;
}

export async function getJournal(): Promise<JournalResponse> {
    const response = await fetch(`${API}/journal`);
    if (!response.ok) throw new Error("Unable to reach Journal endpoint");
    return response.json();
}

export async function patchJournal(
    id: string,
    body: { taken?: TakenStatus; notes?: string }
): Promise<JournalResponse & { entry: JournalEntry }> {
    const response = await fetch(`${API}/journal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Journal update failed");
    return data;
}

export async function resolveJournal(): Promise<JournalResponse & { checked: number; resolved: number }> {
    const response = await fetch(`${API}/journal/resolve`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Resolve failed");
    return data;
}
