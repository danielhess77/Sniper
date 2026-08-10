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
    triggerTime?: string;
    qualifiedAt?: string | null;
    confirmTf?: "30m" | null;
    confirmStatus?: "confirmed" | "pending" | "n/a";
    confirmReason?: string;
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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${API}${path}`, init);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Network error calling ${path}: ${msg}`);
    }

    const text = await response.text();
    let data: unknown = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // non-JSON body
    }

    if (!response.ok) {
        const fromJson =
            data && typeof data === "object" && data !== null && "error" in data
                ? String((data as { error: unknown }).error)
                : null;
        const snippet = text.slice(0, 180).replace(/\s+/g, " ");
        throw new Error(
            fromJson ||
            `API ${path} → HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`
        );
    }

    return data as T;
}

export async function getHealth(): Promise<{ success: boolean; status?: string; pid?: number }> {
    return apiFetch("/health");
}

export async function getScan(): Promise<ScanResponse> {
    return apiFetch("/scan");
}

export async function getSwing(): Promise<SwingResponse> {
    return apiFetch("/swing");
}

export async function getRvol(): Promise<RvolResponse> {
    return apiFetch("/rvol");
}

export async function getWatchlist(): Promise<WatchlistResponse> {
    return apiFetch("/watchlist");
}

export async function putWatchlist(symbols: string[]): Promise<WatchlistResponse> {
    return apiFetch("/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
    });
}

export async function getJournal(): Promise<JournalResponse> {
    return apiFetch("/journal");
}

export async function patchJournal(
    id: string,
    body: { taken?: TakenStatus; notes?: string }
): Promise<JournalResponse & { entry: JournalEntry }> {
    return apiFetch(`/journal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

export async function resolveJournal(): Promise<JournalResponse & { checked: number; resolved: number }> {
    return apiFetch("/journal/resolve", { method: "POST" });
}
