import { useEffect, useMemo, useState } from "react";
import "./styles.css";

import {
    getScan,
    getSwing,
    getRvol,
    getWatchlist,
    putWatchlist
} from "./api";
import type { ScanCard, SwingCard, RvolCard, OptionSuggestion } from "./api";

type TabId = "intraday" | "swing" | "rvol" | "watchlist";
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
                    <div className="detail"><label>Mid / Spread</label><strong>{option.mid.toFixed(2)} · {option.spreadPct}%</strong></div>
                    <div className="detail"><label>Delta</label><strong>{option.delta}</strong></div>
                    <div className="detail"><label>OI / Vol</label><strong>{option.openInterest} / {option.volume}</strong></div>
                    <div className="detail"><label>Why</label><strong>{option.reason}</strong></div>
                </>
            ) : (
                <div className="detail"><label>Why</label><strong>{option.reason}</strong></div>
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

    async function refreshScan() {
        try {
            const scanResponse = await getScan();
            setResults(scanResponse.results);
            setWatchlistCount(scanResponse.watchlist);
            setPlaybooks(scanResponse.playbooks);
            setQualified(scanResponse.qualified);
            setLastScan(new Date(scanResponse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            setSelectedScan(prev => {
                if (!scanResponse.results.length) return null;
                if (!prev) return scanResponse.results[0];
                return scanResponse.results.find(r => r.symbol === prev.symbol && r.playbook === prev.playbook) ?? scanResponse.results[0];
            });
            setError("");
        } catch {
            setError("Unable to connect to Sniper API");
        } finally {
            setLoading(false);
        }
    }

    async function refreshSwing() {
        try {
            const swingResponse = await getSwing();
            setSwingResults(swingResponse.results);
            setSwingQualified(swingResponse.qualified);
            setSwingWatching(swingResponse.watching);
            setWatchlistCount(swingResponse.watchlist);
            setLastSwing(new Date(swingResponse.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            setSelectedSwing(prev => {
                if (!swingResponse.results.length) return null;
                if (!prev) return swingResponse.results[0];
                return swingResponse.results.find(r => r.symbol === prev.symbol && r.horizonId === prev.horizonId) ?? swingResponse.results[0];
            });
        } catch {
            if (tab === "swing") setError("Unable to reach Swing endpoint");
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
        } catch {
            if (tab === "watchlist") setError("Unable to reach Watchlist endpoint");
        }
    }

    useEffect(() => {
        refreshScan();
        refreshSwing();
        refreshRvol();
        refreshWatchlist();
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
        if (swingFilter === "ALL") return swingResults;
        return swingResults.filter(r => r.horizonId === swingFilter);
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
            : tab === "swing" ? "RS + Pullback Swing Scanner"
                : tab === "rvol" ? "Opening + Day Relative Volume"
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
                        <span>{tab === "rvol" ? "Last RVOL" : tab === "swing" ? "Last Swing" : tab === "watchlist" ? "Symbols" : "Last Scan"}</span>
                        <strong>
                            {tab === "rvol" ? lastRvol || "--" : tab === "swing" ? lastSwing || "--" : tab === "watchlist" ? symbols.length : lastScan || "--"}
                        </strong>
                    </div>
                    <div>
                        <span>Refresh</span>
                        <strong>
                            {tab === "rvol" ? "30 min" : tab === "swing" ? "5 min" : tab === "watchlist" ? "manual" : "60 sec"}
                        </strong>
                    </div>
                </div>
            </header>

            <div className="tabs">
                <button className={`tab ${tab === "intraday" ? "active" : ""}`} onClick={() => setTab("intraday")}>Intraday</button>
                <button className={`tab ${tab === "swing" ? "active" : ""}`} onClick={() => setTab("swing")}>Swing</button>
                <button className={`tab ${tab === "rvol" ? "active" : ""}`} onClick={() => setTab("rvol")}>RVOL</button>
                <button className={`tab ${tab === "watchlist" ? "active" : ""}`} onClick={() => { setTab("watchlist"); refreshWatchlist(); }}>Watchlist</button>
            </div>

            {error && <div style={{ color: "#ff5d73", marginBottom: 20 }}>{error}</div>}

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
                            <div className="panelHeader">Ranked Setups</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Symbol</th><th>Playbook</th><th>Triggered</th><th>Score</th><th>Direction</th><th>Entry</th><th>R:R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(scan => (
                                        <tr key={`${scan.symbol}-${scan.playbook}`} onClick={() => setSelectedScan(scan)}>
                                            <td>{scan.symbol}</td>
                                            <td>{scan.playbook}</td>
                                            <td>{scan.triggerTime}</td>
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
                            <div className="panelHeader">Swing Setups</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Symbol</th><th>Horizon</th><th>State</th><th>Score</th><th>RS Rank</th><th>Entry</th><th>R:R</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSwing.map(row => (
                                        <tr key={`${row.symbol}-${row.horizonId}`} onClick={() => setSelectedSwing(row)}>
                                            <td>{row.symbol}</td>
                                            <td>
                                                <span className={row.horizonId === "SHORT" ? "badge badge-short" : "badge badge-intermediate"}>
                                                    {horizonLabel(row.horizonId)}
                                                </span>
                                            </td>
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
                            <span className="rvolMeta">Built once after 10:00 ET · true early leaders</span>
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
