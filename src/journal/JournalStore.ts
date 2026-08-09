/**
 * Sniper Journal Store
 *
 * Version: 1.2
 *
 * Dedupe by signal family (scope/symbol/playbook/setup/entry)
 * so weekend re-logs don't clone Friday setups.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import type {
    JournalEntry,
    JournalOutcome,
    JournalScope,
    JournalSummary,
    TakenStatus
} from "./JournalTypes.js";

function filePath(): string {

    return path.join(process.cwd(), "data", "journal.json");

}

export function etSessionDate(

    d: Date = new Date()

): string {

    return new Intl.DateTimeFormat("en-CA", {

        timeZone: "America/New_York",

        year: "numeric",

        month: "2-digit",

        day: "2-digit"

    }).format(d);

}

function makeDedupeKey(

    scope: JournalScope,

    symbol: string,

    playbook: string,

    setupType: string,

    sessionDate: string

): string {

    return [

        scope,

        symbol.toUpperCase(),

        playbook,

        setupType || "—",

        sessionDate

    ].join("|");

}

/** Same setup identity ignoring session day (catches clones) */
function familyKey(

    e: Pick<JournalEntry, "scope" | "symbol" | "playbook" | "setupType" | "entry" | "direction">

): string {

    return [

        e.scope,

        e.symbol.toUpperCase(),

        e.playbook,

        e.setupType || "—",

        e.direction,

        e.entry.toFixed(2)

    ].join("|");

}

export class JournalStore {

    private entries: JournalEntry[] = [];

    load(): void {

        try {

            const fp = filePath();

            if (!fs.existsSync(fp)) {

                this.entries = [];

                this.persist();

                return;

            }

            const raw = fs.readFileSync(fp, "utf8");

            const parsed = JSON.parse(raw) as { entries?: JournalEntry[] };

            this.entries = Array.isArray(parsed.entries) ? parsed.entries : [];

        } catch (err) {

            console.error("Journal load failed", err);

            this.entries = [];

        }

    }

    private persist(): void {

        const dir = path.join(process.cwd(), "data");

        if (!fs.existsSync(dir)) {

            fs.mkdirSync(dir, { recursive: true });

        }

        const payload =
            JSON.stringify({ entries: this.entries }, null, 2) + "\n";

        fs.writeFileSync(filePath(), payload, "utf8");

    }

    list(): JournalEntry[] {

        return [...this.entries].sort(

            (a, b) =>

                (b.loggedAt || "").localeCompare(a.loggedAt || "")

        );

    }

    getOpen(): JournalEntry[] {

        return this.entries.filter(e => e.outcome === "open");

    }

    logQualified(input: {

        scope: JournalScope;

        symbol: string;

        playbook: string;

        setupType?: string;

        horizonId?: string;

        direction: "BULLISH" | "BEARISH" | "NONE";

        entry: number;

        stop: number;

        target: number;

        riskReward: number;

        score: number;

        rsRank?: number;

        sessionDate?: string;

    }): JournalEntry | null {

        if (!input.symbol || input.entry <= 0 || input.stop <= 0) {

            return null;

        }

        if (input.direction !== "BULLISH" && input.direction !== "BEARISH") {

            return null;

        }

        const sessionDate = input.sessionDate || etSessionDate();

        const setupType = input.setupType || "—";

        const dedupeKey = makeDedupeKey(

            input.scope,

            input.symbol,

            input.playbook,

            setupType,

            sessionDate

        );

        if (this.entries.some(e => e.dedupeKey === dedupeKey)) {

            return null;

        }

        // Also block clones with same entry/setup even if sessionDate differs
        const fam = familyKey({

            scope: input.scope,

            symbol: input.symbol,

            playbook: input.playbook,

            setupType,

            entry: input.entry,

            direction: input.direction

        });

        if (this.entries.some(e => familyKey(e) === fam)) {

            return null;

        }

        const entry: JournalEntry = {

            id: randomUUID(),

            dedupeKey,

            scope: input.scope,

            symbol: input.symbol.toUpperCase(),

            playbook: input.playbook,

            setupType,

            horizonId: input.horizonId || "",

            direction: input.direction,

            entry: input.entry,

            stop: input.stop,

            target: input.target,

            riskReward: input.riskReward,

            score: input.score,

            rsRank: input.rsRank ?? 0,

            sessionDate,

            loggedAt: new Date().toISOString(),

            taken: "unknown",

            outcome: "open",

            rMultiple: null,

            resolvedAt: null,

            exitPrice: null,

            notes: ""

        };

        this.entries.push(entry);

        this.persist();

        return entry;

    }

    setTaken(

        id: string,

        taken: TakenStatus

    ): JournalEntry | null {

        const row = this.entries.find(e => e.id === id);

        if (!row) return null;

        row.taken = taken;

        this.persist();

        return { ...row };

    }

    setNotes(

        id: string,

        notes: string

    ): JournalEntry | null {

        const row = this.entries.find(e => e.id === id);

        if (!row) return null;

        row.notes = notes.slice(0, 500);

        this.persist();

        return { ...row };

    }

    resolve(

        id: string,

        outcome: JournalOutcome,

        exitPrice: number,

        rMultiple: number

    ): JournalEntry | null {

        const row = this.entries.find(e => e.id === id);

        if (!row) return null;

        if (row.outcome !== "open" && outcome !== "manual") {

            return { ...row };

        }

        row.outcome = outcome;

        row.exitPrice = exitPrice;

        row.rMultiple = Number(rMultiple.toFixed(3));

        row.resolvedAt = new Date().toISOString();

        this.persist();

        return { ...row };

    }

    reopen(

        id: string

    ): JournalEntry | null {

        const row = this.entries.find(e => e.id === id);

        if (!row) return null;

        row.outcome = "open";

        row.rMultiple = null;

        row.exitPrice = null;

        row.resolvedAt = null;

        this.persist();

        return { ...row };

    }

    reopenAllStops(): number {

        let n = 0;

        for (const row of this.entries) {

            if (row.outcome === "stop") {

                row.outcome = "open";

                row.rMultiple = null;

                row.exitPrice = null;

                row.resolvedAt = null;

                n++;

            }

        }

        if (n) this.persist();

        return n;

    }

    /**
     * Keep one row per family (scope/symbol/playbook/setup/entry).
     * Prefer open > other; then newest loggedAt.
     */
    cleanupDuplicates(): { removed: number; kept: number } {

        const rank = (e: JournalEntry) => {

            // Higher is better
            let s = 0;

            if (e.outcome === "open") s += 100;

            else if (e.outcome === "target") s += 50;

            else if (e.outcome === "expired") s += 20;

            else if (e.outcome === "stop") s += 5;

            s += Date.parse(e.loggedAt || "0") / 1e13;

            return s;

        };

        const best = new Map<string, JournalEntry>();

        for (const e of this.entries) {

            const k = familyKey(e);

            const prev = best.get(k);

            if (!prev || rank(e) > rank(prev)) {

                best.set(k, e);

            }

        }

        const keepIds = new Set([...best.values()].map(e => e.id));

        const before = this.entries.length;

        this.entries = this.entries.filter(e => keepIds.has(e.id));

        const removed = before - this.entries.length;

        if (removed) this.persist();

        return { removed, kept: this.entries.length };

    }

    summary(): JournalSummary {

        const all = this.entries;

        const open = all.filter(e => e.outcome === "open").length;

        const resolved = all.filter(

            e => e.outcome === "target" || e.outcome === "stop" || e.outcome === "expired" || e.outcome === "manual"

        );

        const wins = resolved.filter(e => (e.rMultiple ?? 0) > 0);

        const losses = resolved.filter(e => (e.rMultiple ?? 0) < 0);

        const expired = all.filter(e => e.outcome === "expired");

        const avg = (rows: JournalEntry[]) => {

            const rs = rows

                .map(e => e.rMultiple)

                .filter((x): x is number => typeof x === "number");

            if (!rs.length) return null;

            return rs.reduce((a, b) => a + b, 0) / rs.length;

        };

        const winRate = (rows: JournalEntry[]) => {

            const decided = rows.filter(

                e => e.rMultiple !== null && e.outcome !== "open"

            );

            if (!decided.length) return null;

            const w = decided.filter(e => (e.rMultiple ?? 0) > 0).length;

            return w / decided.length;

        };

        const byMap = new Map<string, JournalEntry[]>();

        for (const e of resolved) {

            const k = e.playbook || "Unknown";

            if (!byMap.has(k)) byMap.set(k, []);

            byMap.get(k)!.push(e);

        }

        const byPlaybook = [...byMap.entries()].map(([playbook, rows]) => ({

            playbook,

            n: rows.length,

            wins: rows.filter(r => (r.rMultiple ?? 0) > 0).length,

            avgR: avg(rows)

        })).sort((a, b) => b.n - a.n);

        const takenRows = resolved.filter(e => e.taken === "yes");

        return {

            total: all.length,

            open,

            resolved: resolved.length,

            wins: wins.length,

            losses: losses.length,

            expired: expired.length,

            winRate: winRate(resolved),

            avgR: avg(resolved),

            expectancy: avg(resolved),

            takenYes: all.filter(e => e.taken === "yes").length,

            takenResolved: takenRows.length,

            takenWinRate: winRate(takenRows),

            takenAvgR: avg(takenRows),

            takenExpectancy: avg(takenRows),

            byPlaybook

        };

    }

}

export const journalStore = new JournalStore();
