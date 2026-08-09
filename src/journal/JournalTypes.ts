/**
 * Sniper Trade Journal types
 */

export type JournalScope = "intraday" | "swing";

export type JournalOutcome =
    | "open"
    | "target"
    | "stop"
    | "expired"
    | "manual";

export type TakenStatus = "unknown" | "yes" | "no";

export interface JournalEntry {

    id: string;

    /** Dedup key: scope|symbol|playbook|setup|YYYY-MM-DD */
    dedupeKey: string;

    scope: JournalScope;

    symbol: string;

    playbook: string;

    setupType: string;

    horizonId: string;

    direction: "BULLISH" | "BEARISH" | "NONE";

    entry: number;

    stop: number;

    target: number;

    riskReward: number;

    score: number;

    rsRank: number;

    /** Session date ET YYYY-MM-DD when signal logged */
    sessionDate: string;

    loggedAt: string;

    taken: TakenStatus;

    outcome: JournalOutcome;

    /** R multiple: + for win, - for loss; null while open */
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

    byPlaybook: {

        playbook: string;

        n: number;

        wins: number;

        avgR: number | null;

    }[];

}
