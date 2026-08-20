import { useEffect, useMemo, useState } from "react";
import "./styles.css";

import {
    getScan,
    getSwing,
    getRvol,
    getWatchlist,
    putWatchlist,
    getJournal,
    patchJournal,
    resolveJournal
} from "./api";
import type {
    ScanCard,
    SwingCard,
    RvolCard,
    OptionSuggestion,
    JournalEntry,
    JournalSummary,
    TakenStatus
} from "./api";

type TabId = "intraday" | "swing" | "rvol" | "watchlist" | "journal";
type SwingFilter = "ALL" | "SHORT" | "INTERMEDIATE";
type SwingStateFilter = "QUALIFIED" | "WATCHING" | "ALL";

interface JournalDayGroup {
    dayKey: string;
    label: string;
    entries: JournalEntry[];
    n: number;
    resolved: number;
    wins: number;
    winRate: number | null;
    avgR: number | null;
    open: number;
}

/** Minutes since midnight America/New_York */
function etMinutesSinceMidnight(): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find(p => p.type === "minute")?.value ?? "0");
    return (hour % 24) * 60 + minute;
}

function intradayScanIntervalMs(): number {
    const m = etMinutesSinceMidnight();
    const openStart = 9 * 60 + 30;
    const openEnd = 10 * 60 + 30;
    if (m >= openStart && m < openEnd) return 2 * 60_000;
    return 5 * 60_000;
}

function intradayScanIntervalLabel(): string {
    return intradayScanIntervalMs() === 2 * 60_000 ? "2 min (open)" : "5 min";
}

function formatVolume(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

function horizonLabel(id: string): string {
    if (id === "SHORT") return "1–3 Day";
    if (id === "INTERMEDIATE") return "1–3 Week";
    return id;
}

function setupLabel(t?: string): string {
    if (t === "CONSOLIDATION") return "Consolidation";
    if (t === "TIGHT_BASE") return "Tight Base";
    if (t === "PULLBACK") return "Pullback";
    return t || "—";
}
