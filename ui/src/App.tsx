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

function App() {
    const [tab, setTab] = useState<TabId>("intraday");
    const [swingFilter, setSwingFilter] = useState<SwingFilter>("ALL");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastScan, setLastScan] = useState("");
    const [lastSwing, setLastSwing] = useState("");
    const [watchlistCount, setWatchlistCount] = useState(0);
    const [playbooks, setPlaybooks] = useState(0);
    const [qualified, setQualified] = useState(0);
    const [swingQualified, setSwingQualified] = useState(0);
    const [swingWatching, setSwingWatching] = useState(0);
    const [results, setResults] = useState<ScanCard[]>([]);
    const [swingResults, setSwingResults] = useState<SwingCard[]>([]);
    const [selectedScan, setSelectedScan] = useState<ScanCard | null>(null);
    const [selectedSwing, setSelectedSwing] = useState<SwingCard | null>(null);
    const [rvolLive, setRvolLive] = useState<RvolCard[]>([]);
    const [rvolOpening, setRvolOpening] = useState<RvolCard[] | null>(null);
    const [lastRvol, setLastRvol] = useState("");
    const [symbols, setSymbols] = useState<string[]>([]);
    const [draftInput, setDraftInput] = useState("");
    const [watchlistDirty, setWatchlistDirty] = useState(false);
    const [watchlistSaving, setWatchlistSaving] = useState(false);
    const [watchlistMsg, setWatchlistMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [journalSummary, setJournalSummary] = useState<JournalSummary | null>(null);
    const [journalBusy, setJournalBusy] = useState(false);

    async function refreshScan() {
        try {
            const scanResponse = await getScan();
            const visible = scanResponse.results.filter(r => r.qualified);
            setResults(visible);
            setWatchlistCount(scanResponse.watchlist);
            setPlaybooks(scanResponse.playbooks);
            setQualified(scanResponse.qualified);
            setLastScan(new Date(scanResponse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            setSelectedScan(prev => {
                if (!visible.length) return null;
                if (!prev) return visible[0];
                return visible.find(r => r.symbol === prev.symbol && r.playbook === prev.playbook) ?? visible[0];
            });
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to connect to Sniper API");
        } finally {
            setLoading(false);
        }
    }

    async function refreshSwing() {
        try {
            const swingResponse = await getSwing();
            const visible = swingResponse.results.filter(
                r => r.state !== "invalid" && String(r.state).toLowerCase() !== "invalid"
            );
            setSwingResults(visible);
            setSwingQualified(swingResponse.qualified);
            setSwingWatching(swingResponse.watching);
            setWatchlistCount(swingResponse.watchlist);
            setLastSwing(new Date(swingResponse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            setSelectedSwing(prev => {
                if (!visible.length) return null;
                if (!prev) return visible[0];
                return visible.find(
                    r => r.symbol === prev.symbol && r.horizonId === prev.horizonId && (r.setupType || "PULLBACK") === (prev.setupType || "PULLBACK")
                ) ?? visible[0];
            });
        } catch (err) {
            if (tab === "swing") {
                setError(err instanceof Error ? err.message : "Unable to reach Swing endpoint");
            }
        }
    }

    async function refreshRvol() {
        try {
            const rvolResponse = await getRvol();
            if (rvolResponse.success) {
                setRvolLive(rvolResponse.live);
                setRvolOpening(rvolResponse.opening30);
                setLastRvol(new Date(rvolResponse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            }
        } catch {
            // non-critical
        }
    }

    async function refreshWatchlist() {
        try {
            const response = await getWatchlist();
            setSymbols(response.symbols);
            setWatchlistCount(response.count);
            setWatchlistDirty(false);
            setWatchlistMsg(null);
        } catch (err) {
            if (tab === "watchlist") {
                setError(err instanceof Error ? err.message : "Unable to reach Watchlist endpoint");
            }
        }
    }

    async function refreshJournal() {
        try {
            const response = await getJournal();
            setJournalEntries(response.entries);
            setJournalSummary(response.summary);
        } catch (err) {
            if (tab === "journal") {
                setError(err instanceof Error ? err.message : "Unable to reach Journal endpoint");
            }
        }
    }

    async function setTaken(id: string, taken: TakenStatus) {
        try {
            const response = await patchJournal(id, { taken });
            setJournalEntries(response.entries);
            setJournalSummary(response.summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update Taken");
        }
    }

    async function runResolve() {
        setJournalBusy(true);
        try {
            const response = await resolveJournal();
            setJournalEntries(response.entries);
            setJournalSummary(response.summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Resolve failed");
        } finally {
            setJournalBusy(false);
        }
    }

    useEffect(() => {
        refreshScan();
        refreshSwing();
        refreshRvol();
        refreshWatchlist();
        refreshJournal();
        const scanTimer = setInterval(refreshScan, 60_000);
        const swingTimer = setInterval(refreshSwing, 5 * 60_000);
        const rvolTimer = setInterval(refreshRvol, 30 * 60_000);
        return () => {
            clearInterval(scanTimer);
            clearInterval(swingTimer);
            clearInterval(rvolTimer);
        };
    }, []);

    const filteredSwing = useMemo(() => {
        let rows = swingResults.filter(r => r.state !== "invalid");
        if (swingFilter === "ALL") return rows;
        return rows.filter(r => r.horizonId === swingFilter);
    }, [swingResults, swingFilter]);

    const topScore = useMemo(() => (!results.length ? "--" : results[0].score), [results]);
    const topSwingScore = useMemo(() => (!filteredSwing.length ? "--" : filteredSwing[0].score), [filteredSwing]);

    function addSymbol() {
        const parts = draftInput.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
        if (!parts.length) return;
        setSymbols(prev => {
            const next = [...prev];
            for (const p of parts) {
                const clean = p.replace(/[^A-Z0-9.\-]/g, "");
                if (!clean || clean.length > 12) continue;
                if (!next.includes(clean)) next.push(clean);
            }
            return next;
        });
        setDraftInput("");
        setWatchlistDirty(true);
        setWatchlistMsg(null);
    }

    function removeSymbol(symbol: string) {
        setSymbols(prev => prev.filter(s => s !== symbol));
        setWatchlistDirty(true);
        setWatchlistMsg(null);
    }

    async function saveWatchlist() {
        if (!symbols.length) {
            setWatchlistMsg({ type: "err", text: "Watchlist cannot be empty" });
            return;
        }
        setWatchlistSaving(true);
        try {
            const response = await putWatchlist(symbols);
            setSymbols(response.symbols);
            setWatchlistCount(response.count);
            setWatchlistDirty(false);
            setWatchlistMsg({ type: "ok", text: `Saved ${response.count} symbols — next scans will use this list` });
            refreshScan();
            refreshRvol();
        } catch (err) {
            setWatchlistMsg({ type: "err", text: err instanceof Error ? err.message : "Save failed" });
        } finally {
            setWatchlistSaving(false);
        }
    }

    const subtitle =
        tab === "intraday" ? "Institutional Intraday Scanner"
            : tab === "swing" ? "RS + Pullback / Tight Base Swings"
                : tab === "rvol" ? "Opening + Day Relative Volume"
                    : tab === "journal" ? "Qualified Signal Journal & Performance"
                        : "Watchlist Editor";

    function renderRvolTable(rows: RvolCard[], showQuoteCols: boolean) {
        if (!rows.length) {
            return <div className="rvolEmpty">No data yet.</div>;
        }
        return (
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Symbol</th>
                        <th>RVOL</th>
                        <th>{showQuoteCols ? "Volume" : "OR Vol"}</th>
                        <th>{showQuoteCols ? "Avg 10D" : "Avg OR"}</th>
                        {showQuoteCols && <th>Last</th>}
                        {showQuoteCols && <th>Change</th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={`${row.mode || "x"}-${row.symbol}`}>
                            <td>{index + 1}</td>
                            <td>{row.symbol}</td>
                            <td className="rvolValue">{row.rvol.toFixed(2)}x</td>
                            <td>{formatVolume(row.totalVolume)}</td>
                            <td>{formatVolume(row.avg10DaysVolume)}</td>
                            {showQuoteCols && <td>{row.lastPrice ? row.lastPrice.toFixed(2) : "—"}</td>}
                            {showQuoteCols && (
                                <td className={row.netPercentChange >= 0 ? "pos" : "neg"}>
                                    {row.netPercentChange >= 0 ? "+" : ""}{row.netPercentChange.toFixed(2)}%
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <div className="app">
            <header className="header">
                <div>
                    <h1>SNIPER</h1>
                    <p>{subtitle}</p>
                </div>
                <div className="status">
                    <div>
                        <span>Status</span>
                        <strong>{loading ? "LOADING" : "LIVE"}</strong>
                    </div>
                    <div>
                        <span>
                            {tab === "rvol" ? "Last RVOL"
                                : tab === "swing" ? "Last Scan"
                                    : tab === "watchlist" ? "Symbols"
                                        : tab === "journal" ? "Entries"
                                            : "Last Scan"}
                        </span>
                        <strong>
                            {tab === "rvol" ? lastRvol || "--"
                                : tab === "swing" ? lastSwing || "--"
                                    : tab === "watchlist" ? symbols.length
                                        : tab === "journal" ? journalEntries.length
                                            : lastScan || "--"}
                        </strong>
                    </div>
                    <div>
                        <span>Refresh</span>
                        <strong>
                            {tab === "rvol" ? "30 min"
                                : tab === "swing" ? "5 min"
                                    : tab === "watchlist" || tab === "journal" ? "manual"
                                        : "60 sec"}
                        </strong>
                    </div>
                </div>
            </header>

            <div className="tabs">
                <button className={`tab ${tab === "intraday" ? "active" : ""}`} onClick={() => setTab("intraday")}>Intraday</button>
                <button className={`tab ${tab === "swing" ? "active" : ""}`} onClick={() => setTab("swing")}>Swing</button>
                <button className={`tab ${tab === "rvol" ? "active" : ""}`} onClick={() => setTab("rvol")}>RVOL</button>
                <button className={`tab ${tab === "journal" ? "active" : ""}`} onClick={() => { setTab("journal"); refreshJournal(); }}>Journal</button>
                <button className={`tab ${tab === "watchlist" ? "active" : ""}`} onClick={() => { setTab("watchlist"); refreshWatchlist(); }}>Watchlist</button>
            </div>

            {error && <div style={{ color: "#ff5d73", marginBottom: 20, maxWidth: 900 }}>{error}</div>}

            {tab === "intraday" && (
                <>
                    <section className="summary">
                        <div className="card"><span>Watchlist</span><strong>{watchlistCount}</strong></div>
                        <div className="card"><span>Playbooks</span><strong>{playbooks}</strong></div>
                        <div className="card"><span>Qualified</span><strong>{qualified}</strong></div>
                        <div className="card"><span>Top Score</span><strong>{topScore}</strong></div>
                    </section>
                    <section className="content">
                        <div className="tablePanel">
                            <div className="panelHeader">Ranked Setups (qualified only)</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Symbol</th><th>Playbook</th><th>Qualified</th><th>Score</th><th>Direction</th><th>Entry</th><th>R:R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.length === 0 ? (
                                        <tr><td colSpan={7} style={{ color: "#8ea2c7" }}>No qualified intraday setups right now.</td></tr>
                                    ) : results.map(scan => (
                                        <tr key={`${scan.symbol}-${scan.playbook}`} onClick={() => setSelectedScan(scan)}>
                                            <td>{scan.symbol}</td>
                                            <td>{scan.playbook}</td>
                                            <td>{scan.triggerTime || formatEtStamp(scan.qualifiedAt)}</td>
                                            <td>{scan.score}</td>
                                            <td>{scan.direction}</td>
                                            <td>{scan.entry.toFixed(2)}</td>
                                            <td>{scan.riskReward.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="detailsPanel">
                            <div className="panelHeader">Trade Details</div>
                            {selectedScan ? (
                                <>
                                    <div className="detail"><label>Symbol</label><strong>{selectedScan.symbol}</strong></div>
                                    <div className="detail"><label>Playbook</label><strong>{selectedScan.playbook}</strong></div>
                                    <div className="detail"><label>Qualified</label><strong>{selectedScan.triggerTime}{selectedScan.qualifiedAt ? ` · ${formatEtStamp(selectedScan.qualifiedAt)}` : ""}</strong></div>
                                    <div className="detail"><label>Score</label><strong>{selectedScan.score}</strong></div>
                                    <div className="detail"><label>Direction</label><strong>{selectedScan.direction}</strong></div>
                                    <div className="detail"><label>Entry</label><strong>{selectedScan.entry.toFixed(2)}</strong></div>
                                    <div className="detail"><label>Stop</label><strong>{selectedScan.stop.toFixed(2)}</strong></div>
                                    <div className="detail"><label>Target</label><strong>{selectedScan.target.toFixed(2)}</strong></div>
                                    <div className="detail"><label>Risk / Reward</label><strong>{selectedScan.riskReward.toFixed(2)}</strong></div>
                                    {selectedScan.option && <OptionBlock option={selectedScan.option} />}
                                </>
                            ) : (
                                <div style={{ padding: 20, color: "#8ea2c7" }}>No setup selected.</div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {tab === "swing" && (
                <>
                    <section className="summary">
                        <div className="card"><span>Watchlist</span><strong>{watchlistCount}</strong></div>
                        <div className="card"><span>Qualified</span><strong>{swingQualified}</strong></div>
                        <div className="card"><span>Watching</span><strong>{swingWatching}</strong></div>
                        <div className="card"><span>Top Score</span><strong>{topSwingScore}</strong></div>
                    </section>
                    <div className="filters">
                        <button className={`filterBtn ${swingFilter === "ALL" ? "active" : ""}`} onClick={() => setSwingFilter("ALL")}>All</button>
                        <button className={`filterBtn ${swingFilter === "SHORT" ? "active" : ""}`} onClick={() => setSwingFilter("SHORT")}>1–3 Day</button>
                        <button className={`filterBtn ${swingFilter === "INTERMEDIATE" ? "active" : ""}`} onClick={() => setSwingFilter("INTERMEDIATE")}>1–3 Week</button>
                    </div>
                    <section className="content">
                        <div className="tablePanel">
                            <div className="panelHeader">Swing Setups (watching + qualified)</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Symbol</th><th>Horizon</th><th>Setup</th><th>Qualified</th><th>State</th><th>Score</th><th>RS Rank</th><th>Entry</th><th>R:R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSwing.length === 0 ? (
                                        <tr><td colSpan={9} style={{ color: "#8ea2c7" }}>No watching or qualified swing setups right now.</td></tr>
                                    ) : filteredSwing.map(row => (
                                        <tr
                                            key={`${row.symbol}-${row.horizonId}-${row.setupType || "PULLBACK"}`}
                                            onClick={() => setSelectedSwing(row)}
                                        >
                                            <td>{row.symbol}</td>
                                            <td>
                                                <span className={row.horizonId === "SHORT" ? "badge badge-short" : "badge badge-intermediate"}>
                                                    {horizonLabel(row.horizonId)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge-state">{setupLabel(row.setupType)}</span>
                                            </td>
                                            <td>{row.triggerTime || formatEtStamp(row.qualifiedAt, false)}</td>
                                            <td>
                                                <span className={row.qualified ? "badge badge-qualified" : "badge badge-state"}>{row.state}</span>
                                            </td>
                                            <td>{row.score}</td>
                                            <td>#{row.rsRank || "—"}</td>
                                            <td>{row.entry ? row.entry.toFixed(2) : "—"}</td>
                                            <td>{row.riskReward ? row.riskReward.toFixed(2) : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="detailsPanel">
                            <div className="panelHeader">Swing Details</div>
                            {selectedSwing ? (
                                <>
                                    <div className="detail"><label>Symbol</label><strong>{selectedSwing.symbol}</strong></div>
                                    <div className="detail"><label>Horizon</label><strong>{horizonLabel(selectedSwing.horizonId)}</strong></div>
                                    <div className="detail"><label>Setup</label><strong>{setupLabel(selectedSwing.setupType)}</strong></div>
                                    <div className="detail"><label>Qualified</label><strong>{selectedSwing.triggerTime || formatEtStamp(selectedSwing.qualifiedAt, false)}</strong></div>
                                    <div className="detail"><label>State</label><strong>{selectedSwing.state}</strong></div>
                                    <div className="detail"><label>Score</label><strong>{selectedSwing.score}</strong></div>
                                    <div className="detail"><label>RS Rank</label><strong>#{selectedSwing.rsRank} ({(selectedSwing.rs * 100).toFixed(1)}% vs SPY)</strong></div>
                                    <div className="detail"><label>Entry</label><strong>{selectedSwing.entry ? selectedSwing.entry.toFixed(2) : "—"}</strong></div>
                                    <div className="detail"><label>Stop</label><strong>{selectedSwing.stop ? selectedSwing.stop.toFixed(2) : "—"}</strong></div>
                                    <div className="detail"><label>Target</label><strong>{selectedSwing.target ? selectedSwing.target.toFixed(2) : "—"}</strong></div>
                                    <div className="detail"><label>Risk / Reward</label><strong>{selectedSwing.riskReward ? selectedSwing.riskReward.toFixed(2) : "—"}</strong></div>
                                    <div className="detail"><label>Reason</label><strong>{selectedSwing.reason}</strong></div>
                                    {selectedSwing.option && <OptionBlock option={selectedSwing.option} />}
                                </>
                            ) : (
                                <div style={{ padding: 20, color: "#8ea2c7" }}>No swing selected.</div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {tab === "rvol" && (
                <>
                    <section className="rvolPanel" style={{ marginBottom: 24 }}>
                        <div className="panelHeader rvolHeader">
                            <span>Opening RVOL (9:30–10:00 vs avg OR)</span>
                            <span className="rvolMeta">Built once after 10:00 ET (first heavy pass of the day)</span>
                        </div>
                        {!rvolOpening || rvolOpening.length === 0
                            ? <div className="rvolEmpty">Available after 10:00 ET (first heavy pass of the day).</div>
                            : renderRvolTable(rvolOpening, false)}
                    </section>
                    <section className="rvolPanel">
                        <div className="panelHeader rvolHeader">
                            <span>Live Day RVOL (total ÷ avg 10D)</span>
                            <span className="rvolMeta">{lastRvol ? `Updated ${lastRvol} · every 30 min` : "every 30 min"}</span>
                        </div>
                        {renderRvolTable(rvolLive, true)}
                    </section>
                </>
            )}

            {tab === "journal" && (
                <>
                    <section className="summary">
                        <div className="card"><span>Logged</span><strong>{journalSummary?.total ?? 0}</strong></div>
                        <div className="card"><span>Open</span><strong>{journalSummary?.open ?? 0}</strong></div>
                        <div className="card"><span>Win Rate</span><strong>{fmtPct(journalSummary?.winRate ?? null)}</strong></div>
                        <div className="card"><span>Expectancy</span><strong>{fmtR(journalSummary?.expectancy ?? null)}</strong></div>
                    </section>
                    <section className="summary" style={{ marginTop: 0 }}>
                        <div className="card"><span>Taken</span><strong>{journalSummary?.takenYes ?? 0}</strong></div>
                        <div className="card"><span>Taken Win %</span><strong>{fmtPct(journalSummary?.takenWinRate ?? null)}</strong></div>
                        <div className="card"><span>Taken Avg R</span><strong>{fmtR(journalSummary?.takenAvgR ?? null)}</strong></div>
                        <div className="card"><span>Taken Exp</span><strong>{fmtR(journalSummary?.takenExpectancy ?? null)}</strong></div>
                    </section>
                    <div className="filters" style={{ marginBottom: 16 }}>
                        <button className="filterBtn" type="button" disabled={journalBusy} onClick={() => refreshJournal()}>Refresh</button>
                        <button className="filterBtn active" type="button" disabled={journalBusy} onClick={runResolve}>
                            {journalBusy ? "Resolving…" : "Resolve open vs price"}
                        </button>
                    </div>
                    <section className="content">
                        <div className="tablePanel" style={{ width: "100%" }}>
                            <div className="panelHeader">Qualified signals (auto-logged)</div>
                            {!journalEntries.length ? (
                                <div className="rvolEmpty">No journal entries yet — run scans; qualified setups log automatically.</div>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Logged</th>
                                            <th>Scope</th>
                                            <th>Symbol</th>
                                            <th>Playbook</th>
                                            <th>Dir</th>
                                            <th>Entry</th>
                                            <th>Outcome</th>
                                            <th>R</th>
                                            <th>Taken</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {journalEntries.map(e => (
                                            <tr key={e.id}>
                                                <td title={e.loggedAt}>{formatEtStamp(e.loggedAt)}</td>
                                                <td>{e.scope}</td>
                                                <td>{e.symbol}</td>
                                                <td>{e.playbook}</td>
                                                <td>{e.direction}</td>
                                                <td>{e.entry.toFixed(2)}</td>
                                                <td>
                                                    <span className={e.outcome === "target" ? "badge badge-qualified" : "badge badge-state"}>
                                                        {e.outcome}
                                                    </span>
                                                </td>
                                                <td style={{ color: (e.rMultiple ?? 0) >= 0 ? "#31d07d" : "#ff5d73" }}>
                                                    {e.rMultiple === null ? "—" : fmtR(e.rMultiple)}
                                                </td>
                                                <td>
                                                    <select
                                                        value={e.taken}
                                                        onChange={ev => setTaken(e.id, ev.target.value as TakenStatus)}
                                                        style={{
                                                            background: "#121a2b",
                                                            color: "#e8eefc",
                                                            border: "1px solid #283852",
                                                            borderRadius: 6,
                                                            padding: "4px 6px"
                                                        }}
                                                    >
                                                        <option value="unknown">?</option>
                                                        <option value="yes">Yes</option>
                                                        <option value="no">No</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                    {journalSummary && journalSummary.byPlaybook.length > 0 && (
                        <section className="rvolPanel" style={{ marginTop: 24 }}>
                            <div className="panelHeader">By playbook (resolved)</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Playbook</th>
                                        <th>N</th>
                                        <th>Wins</th>
                                        <th>Avg R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {journalSummary.byPlaybook.map(row => (
                                        <tr key={row.playbook}>
                                            <td>{row.playbook}</td>
                                            <td>{row.n}</td>
                                            <td>{row.wins}</td>
                                            <td>{fmtR(row.avgR)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    )}
                </>
            )}

            {tab === "watchlist" && (
                <section className="watchlistPanel">
                    <div className="panelHeader">Edit Watchlist ({symbols.length})</div>
                    <div className="watchlistBody">
                        <div className="watchlistAdd">
                            <input
                                value={draftInput}
                                onChange={e => setDraftInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSymbol(); } }}
                                placeholder="Add symbol(s) — e.g. AAPL or AAPL, AMD TSLA"
                            />
                            <button className="btn btn-primary" type="button" onClick={addSymbol}>Add</button>
                        </div>
                        <div className="chipGrid">
                            {symbols.map(symbol => (
                                <span className="chip" key={symbol}>
                                    {symbol}
                                    <button type="button" aria-label={`Remove ${symbol}`} onClick={() => removeSymbol(symbol)}>×</button>
                                </span>
                            ))}
                        </div>
                        <div className="watchlistFooter">
                            <span className="watchlistHint">
                                {watchlistDirty ? "Unsaved changes — Save to apply to scans" : "Saved list is used by Intraday, Swing, and RVOL"}
                            </span>
                            <button className="btn btn-success" type="button" disabled={!watchlistDirty || watchlistSaving} onClick={saveWatchlist}>
                                {watchlistSaving ? "Saving…" : "Save watchlist"}
                            </button>
                        </div>
                        {watchlistMsg && (
                            <div className={watchlistMsg.type === "ok" ? "watchlistMsg ok" : "watchlistMsg err"}>{watchlistMsg.text}</div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

export default App;
