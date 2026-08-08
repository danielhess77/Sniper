import { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { getScan, getSwing, getRvol } from "./api";
import type { ScanCard, SwingCard, RvolCard } from "./api";

type TabId = "intraday" | "swing" | "rvol";

type SwingFilter = "ALL" | "SHORT" | "INTERMEDIATE";

function formatVolume(n: number): string {

    if (n >= 1_000_000) {

        return `${(n / 1_000_000).toFixed(1)}M`;

    }

    if (n >= 1_000) {

        return `${(n / 1_000).toFixed(0)}K`;

    }

    return String(n);

}

function horizonLabel(id: string): string {

    if (id === "SHORT") return "1–3 Day";

    if (id === "INTERMEDIATE") return "1–3 Week";

    return id;

}

function App() {

    const [tab, setTab] =
        useState<TabId>("intraday");

    const [swingFilter, setSwingFilter] =
        useState<SwingFilter>("ALL");

    const [loading, setLoading] = useState(true);

    const [error, setError] =
        useState("");

    const [lastScan, setLastScan] =
        useState("");

    const [lastSwing, setLastSwing] =
        useState("");

    const [watchlist, setWatchlist] =
        useState(0);

    const [playbooks, setPlaybooks] =
        useState(0);

    const [qualified, setQualified] =
        useState(0);

    const [swingQualified, setSwingQualified] =
        useState(0);

    const [swingWatching, setSwingWatching] =
        useState(0);

    const [results, setResults] =
        useState<ScanCard[]>([]);

    const [swingResults, setSwingResults] =
        useState<SwingCard[]>([]);

    const [selectedScan, setSelectedScan] =
        useState<ScanCard | null>(null);

    const [selectedSwing, setSelectedSwing] =
        useState<SwingCard | null>(null);

    const [rvolLive, setRvolLive] =
        useState<RvolCard[]>([]);

    const [lastRvol, setLastRvol] =
        useState("");

    async function refreshScan() {

        try {

            const scanResponse =
                await getScan();

            setResults(scanResponse.results);

            setWatchlist(scanResponse.watchlist);

            setPlaybooks(scanResponse.playbooks);

            setQualified(scanResponse.qualified);

            setLastScan(

                new Date(scanResponse.timestamp).toLocaleTimeString([], {

                    hour: "2-digit",

                    minute: "2-digit",

                    second: "2-digit"

                })

            );

            setSelectedScan(prev => {

                if (!scanResponse.results.length) return null;

                if (!prev) return scanResponse.results[0];

                return (

                    scanResponse.results.find(

                        r =>

                            r.symbol === prev.symbol &&

                            r.playbook === prev.playbook

                    ) ?? scanResponse.results[0]

                );

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

            const swingResponse =
                await getSwing();

            setSwingResults(swingResponse.results);

            setSwingQualified(swingResponse.qualified);

            setSwingWatching(swingResponse.watching);

            setWatchlist(swingResponse.watchlist);

            setLastSwing(

                new Date(swingResponse.timestamp).toLocaleTimeString([], {

                    hour: "2-digit",

                    minute: "2-digit",

                    second: "2-digit"

                })

            );

            setSelectedSwing(prev => {

                if (!swingResponse.results.length) return null;

                if (!prev) return swingResponse.results[0];

                return (

                    swingResponse.results.find(

                        r =>

                            r.symbol === prev.symbol &&

                            r.horizonId === prev.horizonId

                    ) ?? swingResponse.results[0]

                );

            });

        } catch {

            // leave prior swing data; surface only if active tab

            if (tab === "swing") {

                setError("Unable to reach Swing endpoint");

            }

        }

    }

    async function refreshRvol() {

        try {

            const rvolResponse =
                await getRvol();

            if (rvolResponse.success) {

                setRvolLive(rvolResponse.live);

                setLastRvol(

                    new Date(rvolResponse.timestamp).toLocaleTimeString([], {

                        hour: "2-digit",

                        minute: "2-digit",

                        second: "2-digit"

                    })

                );

            }

        } catch {

            // non-critical

        }

    }

    useEffect(() => {

        refreshScan();

        refreshSwing();

        refreshRvol();

        const scanTimer = setInterval(refreshScan, 60_000);

        const swingTimer = setInterval(refreshSwing, 5 * 60_000);

        const rvolTimer = setInterval(refreshRvol, 15 * 60_000);

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

    const topScore = useMemo(() => {

        if (!results.length) return "--";

        return results[0].score;

    }, [results]);

    const topSwingScore = useMemo(() => {

        if (!filteredSwing.length) return "--";

        return filteredSwing[0].score;

    }, [filteredSwing]);

    const subtitle =

        tab === "intraday"

            ? "Institutional Intraday Scanner"

            : tab === "swing"

                ? "RS + Pullback Swing Scanner"

                : "Relative Volume Leaderboard";

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

                            {tab === "rvol"

                                ? "Last RVOL"

                                : tab === "swing"

                                    ? "Last Swing"

                                    : "Last Scan"}

                        </span>

                        <strong>

                            {tab === "rvol"

                                ? lastRvol || "--"

                                : tab === "swing"

                                    ? lastSwing || "--"

                                    : lastScan || "--"}

                        </strong>

                    </div>

                    <div>

                        <span>Refresh</span>

                        <strong>

                            {tab === "rvol"

                                ? "15 min"

                                : tab === "swing"

                                    ? "5 min"

                                    : "60 sec"}

                        </strong>

                    </div>

                </div>

            </header>

            <div className="tabs">

                <button

                    className={`tab ${tab === "intraday" ? "active" : ""}`}

                    onClick={() => setTab("intraday")}

                >

                    Intraday

                </button>

                <button

                    className={`tab ${tab === "swing" ? "active" : ""}`}

                    onClick={() => setTab("swing")}

                >

                    Swing

                </button>

                <button

                    className={`tab ${tab === "rvol" ? "active" : ""}`}

                    onClick={() => setTab("rvol")}

                >

                    RVOL

                </button>

            </div>

            {error && (

                <div style={{ color: "#ff5d73", marginBottom: 20 }}>

                    {error}

                </div>

            )}

            {tab === "intraday" && (

                <>

                    <section className="summary">

                        <div className="card">

                            <span>Watchlist</span>

                            <strong>{watchlist}</strong>

                        </div>

                        <div className="card">

                            <span>Playbooks</span>

                            <strong>{playbooks}</strong>

                        </div>

                        <div className="card">

                            <span>Qualified</span>

                            <strong>{qualified}</strong>

                        </div>

                        <div className="card">

                            <span>Top Score</span>

                            <strong>{topScore}</strong>

                        </div>

                    </section>

                    <section className="content">

                        <div className="tablePanel">

                            <div className="panelHeader">Ranked Setups</div>

                            <table>

                                <thead>

                                    <tr>

                                        <th>Symbol</th>

                                        <th>Playbook</th>

                                        <th>Triggered</th>

                                        <th>Score</th>

                                        <th>Direction</th>

                                        <th>Entry</th>

                                        <th>R:R</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {results.map(scan => (

                                        <tr

                                            key={`${scan.symbol}-${scan.playbook}`}

                                            onClick={() => setSelectedScan(scan)}

                                        >

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

                                    <div className="detail">

                                        <label>Symbol</label>

                                        <strong>{selectedScan.symbol}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Playbook</label>

                                        <strong>{selectedScan.playbook}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Score</label>

                                        <strong>{selectedScan.score}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Direction</label>

                                        <strong>{selectedScan.direction}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Entry</label>

                                        <strong>{selectedScan.entry.toFixed(2)}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Stop</label>

                                        <strong>{selectedScan.stop.toFixed(2)}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Target</label>

                                        <strong>{selectedScan.target.toFixed(2)}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Risk / Reward</label>

                                        <strong>{selectedScan.riskReward.toFixed(2)}</strong>

                                    </div>

                                </>

                            ) : (

                                <div style={{ padding: 20, color: "#8ea2c7" }}>

                                    No setup selected.

                                </div>

                            )}

                        </div>

                    </section>

                </>

            )}

            {tab === "swing" && (

                <>

                    <section className="summary">

                        <div className="card">

                            <span>Watchlist</span>

                            <strong>{watchlist}</strong>

                        </div>

                        <div className="card">

                            <span>Qualified</span>

                            <strong>{swingQualified}</strong>

                        </div>

                        <div className="card">

                            <span>Watching</span>

                            <strong>{swingWatching}</strong>

                        </div>

                        <div className="card">

                            <span>Top Score</span>

                            <strong>{topSwingScore}</strong>

                        </div>

                    </section>

                    <div className="filters">

                        <button

                            className={`filterBtn ${swingFilter === "ALL" ? "active" : ""}`}

                            onClick={() => setSwingFilter("ALL")}

                        >

                            All

                        </button>

                        <button

                            className={`filterBtn ${swingFilter === "SHORT" ? "active" : ""}`}

                            onClick={() => setSwingFilter("SHORT")}

                        >

                            1–3 Day

                        </button>

                        <button

                            className={`filterBtn ${swingFilter === "INTERMEDIATE" ? "active" : ""}`}

                            onClick={() => setSwingFilter("INTERMEDIATE")}

                        >

                            1–3 Week

                        </button>

                    </div>

                    <section className="content">

                        <div className="tablePanel">

                            <div className="panelHeader">Swing Setups</div>

                            <table>

                                <thead>

                                    <tr>

                                        <th>Symbol</th>

                                        <th>Horizon</th>

                                        <th>State</th>

                                        <th>Score</th>

                                        <th>RS Rank</th>

                                        <th>Entry</th>

                                        <th>R:R</th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {filteredSwing.map(row => (

                                        <tr

                                            key={`${row.symbol}-${row.horizonId}`}

                                            onClick={() => setSelectedSwing(row)}

                                        >

                                            <td>{row.symbol}</td>

                                            <td>

                                                <span

                                                    className={

                                                        row.horizonId === "SHORT"

                                                            ? "badge badge-short"

                                                            : "badge badge-intermediate"

                                                    }

                                                >

                                                    {horizonLabel(row.horizonId)}

                                                </span>

                                            </td>

                                            <td>

                                                <span

                                                    className={

                                                        row.qualified

                                                            ? "badge badge-qualified"

                                                            : "badge badge-state"

                                                    }

                                                >

                                                    {row.state}

                                                </span>

                                            </td>

                                            <td>{row.score}</td>

                                            <td>#{row.rsRank || "—"}</td>

                                            <td>

                                                {row.entry

                                                    ? row.entry.toFixed(2)

                                                    : "—"}

                                            </td>

                                            <td>

                                                {row.riskReward

                                                    ? row.riskReward.toFixed(2)

                                                    : "—"}

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                        <div className="detailsPanel">

                            <div className="panelHeader">Swing Details</div>

                            {selectedSwing ? (

                                <>

                                    <div className="detail">

                                        <label>Symbol</label>

                                        <strong>{selectedSwing.symbol}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Horizon</label>

                                        <strong>{horizonLabel(selectedSwing.horizonId)}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>State</label>

                                        <strong>{selectedSwing.state}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>Score</label>

                                        <strong>{selectedSwing.score}</strong>

                                    </div>

                                    <div className="detail">

                                        <label>RS Rank</label>

                                        <strong>

                                            #{selectedSwing.rsRank}{" "}

                                            ({(selectedSwing.rs * 100).toFixed(1)}% vs SPY)

                                        </strong>

                                    </div>

                                    <div className="detail">

                                        <label>Entry</label>

                                        <strong>

                                            {selectedSwing.entry

                                                ? selectedSwing.entry.toFixed(2)

                                                : "—"}

                                        </strong>

                                    </div>

                                    <div className="detail">

                                        <label>Stop</label>

                                        <strong>

                                            {selectedSwing.stop

                                                ? selectedSwing.stop.toFixed(2)

                                                : "—"}

                                        </strong>

                                    </div>

                                    <div className="detail">

                                        <label>Target</label>

                                        <strong>

                                            {selectedSwing.target

                                                ? selectedSwing.target.toFixed(2)

                                                : "—"}

                                        </strong>

                                    </div>

                                    <div className="detail">

                                        <label>Risk / Reward</label>

                                        <strong>

                                            {selectedSwing.riskReward

                                                ? selectedSwing.riskReward.toFixed(2)

                                                : "—"}

                                        </strong>

                                    </div>

                                    <div className="detail">

                                        <label>Reason</label>

                                        <strong>{selectedSwing.reason}</strong>

                                    </div>

                                </>

                            ) : (

                                <div style={{ padding: 20, color: "#8ea2c7" }}>

                                    No swing selected.

                                </div>

                            )}

                        </div>

                    </section>

                </>

            )}

            {tab === "rvol" && (

                <section className="rvolPanel">

                    <div className="panelHeader rvolHeader">

                        <span>Highest RVOL (Live)</span>

                        <span className="rvolMeta">

                            {lastRvol

                                ? `Updated ${lastRvol} · every 15 min`

                                : "every 15 min"}

                        </span>

                    </div>

                    {rvolLive.length === 0 ? (

                        <div className="rvolEmpty">No RVOL data yet.</div>

                    ) : (

                        <table>

                            <thead>

                                <tr>

                                    <th>#</th>

                                    <th>Symbol</th>

                                    <th>RVOL</th>

                                    <th>Volume</th>

                                    <th>Avg 10D</th>

                                    <th>Last</th>

                                    <th>Change</th>

                                </tr>

                            </thead>

                            <tbody>

                                {rvolLive.map((row, index) => (

                                    <tr key={row.symbol}>

                                        <td>{index + 1}</td>

                                        <td>{row.symbol}</td>

                                        <td className="rvolValue">

                                            {row.rvol.toFixed(2)}x

                                        </td>

                                        <td>{formatVolume(row.totalVolume)}</td>

                                        <td>{formatVolume(row.avg10DaysVolume)}</td>

                                        <td>{row.lastPrice.toFixed(2)}</td>

                                        <td

                                            className={

                                                row.netPercentChange >= 0

                                                    ? "pos"

                                                    : "neg"

                                            }

                                        >

                                            {row.netPercentChange >= 0 ? "+" : ""}

                                            {row.netPercentChange.toFixed(2)}%

                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    )}

                </section>

            )}

        </div>

    );

}

export default App;
