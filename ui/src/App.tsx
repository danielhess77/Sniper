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

function fmtPct(n: number | null): string {
    if (n === null || n === undefined) return "—";
    return `${(n * 100).toFixed(0)}%`;
}

function fmtR(n: number | null): string {
    if (n === null || n === undefined) return "—";
    const s = n >= 0 ? "+" : "";
    return `${s}${n.toFixed(2)}R`;
}

function formatEtStamp(iso: string | null | undefined, withTime = true): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        ...(withTime
            ? { hour: "numeric", minute: "2-digit" }
            : { year: "numeric" })
    });
}

/** Prefer sessionDate; fall back to loggedAt ET calendar day YYYY-MM-DD */
function tradingDayKey(e: JournalEntry): string {
    if (e.sessionDate && /^\d{4}-\d{2}-\d{2}/.test(e.sessionDate)) {
        return e.sessionDate.slice(0, 10);
    }
    const d = new Date(e.loggedAt);
    if (Number.isNaN(d.getTime())) return "unknown";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);
    const y = parts.find(p => p.type === "year")?.value ?? "0000";
    const m = parts.find(p => p.type === "month")?.value ?? "00";
    const day = parts.find(p => p.type === "day")?.value ?? "00";
    return `${y}-${m}-${day}`;
}

function tradingDayLabel(dayKey: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey;
    const d = new Date(`${dayKey}T16:00:00.000Z`);
    return d.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function buildJournalDays(entries: JournalEntry[]): JournalDayGroup[] {
    const map = new Map<string, JournalEntry[]>();
    for (const e of entries) {
        const k = tradingDayKey(e);
        const list = map.get(k) ?? [];
        list.push(e);
        map.set(k, list);
    }
    const days: JournalDayGroup[] = [];
    for (const [dayKey, list] of map) {
        const resolved = list.filter(e => e.outcome !== "open" && e.rMultiple !== null);
        const wins = resolved.filter(e => (e.rMultiple ?? 0) > 0).length;
        const rs = resolved.map(e => e.rMultiple as number);
        const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
        const winRate = resolved.length ? wins / resolved.length : null;
        days.push({
            dayKey,
            label: tradingDayLabel(dayKey),
            entries: list,
            n: list.length,
            resolved: resolved.length,
            wins,
            winRate,
            avgR,
            open: list.filter(e => e.outcome === "open").length
        });
    }
    days.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    return days;
}

function OptionBlock({ option }: { option: OptionSuggestion }) {
    return (
        <>
            <div className="detail" style={{ borderTop: "1px solid #283852", marginTop: 4 }}>
                <label>Option</label>
                <strong style={{ color: option.ok ? "#31d07d" : "#ff5d73" }}>
                    {option.ok ? `${option.side} ${option.strike}` : "No liquid contract"}
                </strong>
            </div>
            {option.ok ? (
                <>
                    <div className="detail"><label>Contract</label><strong>{option.description || option.symbol}</strong></div>
                    <div className="detail"><label>Expiry / DTE</label><strong>{option.expiration} · {option.dte}d</strong></div>
                    <div className="detail"><label>Bid / Ask</label><strong>{option.bid.toFixed(2)} / {option.ask.toFixed(2)}</strong></div>
                </>
            ) : (
                <div className="detail"><label>Note</label><strong>{option.reason}</strong></div>
            )}
        </>
    );
}
