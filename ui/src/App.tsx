import { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { getScan, getRvol } from "./api";
import type { ScanCard, RvolCard } from "./api";

function formatVolume(n: number): string {

    if (n >= 1_000_000) {

        return `${(n / 1_000_000).toFixed(1)}M`;

    }

    if (n >= 1_000) {

        return `${(n / 1_000).toFixed(0)}K`;

    }

    return String(n);

}

function App() {

    const [loading, setLoading] = useState(true);

    const [error, setError] =
        useState("");

    const [lastScan, setLastScan] =
        useState("");

    const [watchlist, setWatchlist] =
        useState(0);

    const [playbooks, setPlaybooks] =
        useState(0);

    const [qualified, setQualified] =
        useState(0);

    const [results, setResults] =
        useState<ScanCard[]>([]);

    const [selected, setSelected] =
        useState<ScanCard | null>(null);

    const [rvolLive, setRvolLive] =
        useState<RvolCard[]>([]);

    const [rvolOpening30, setRvolOpening30] =
        useState<RvolCard[] | null>(null);

    const [afterOpen30, setAfterOpen30] =
        useState(false);

    async function refresh() {

        try {

            const [scanResponse, rvolResponse] =
                await Promise.all([

                    getScan(),

                    getRvol().catch(() => null)

                ]);

            setResults(scanResponse.results);

            setWatchlist(
                scanResponse.watchlist
            );

            setPlaybooks(
                scanResponse.playbooks
            );

            setQualified(
                scanResponse.qualified
            );

            setLastScan(

                new Date(

                    scanResponse.timestamp

                ).toLocaleTimeString(

                    [],

                    {

                        hour: "2-digit",

                        minute: "2-digit",

                        second: "2-digit"

                    }

                )

            );

            if (

                scanResponse.results.length &&
                !selected

            ) {

                setSelected(

                    scanResponse.results[0]

                );

            }

            if (rvolResponse?.success) {

                setRvolLive(rvolResponse.live);

                setRvolOpening30(rvolResponse.opening30);

                setAfterOpen30(rvolResponse.afterOpen30);

            }

            setError("");

        }

        catch {

            setError(

                "Unable to connect to Sniper API"

            );

        }

        finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        refresh();

        const timer =

            setInterval(

                refresh,

                60000

            );

        return () =>

            clearInterval(timer);

    }, []);

    const topScore = useMemo(() => {

        if (!results.length)

            return "--";

        return results[0].score;

    }, [results]);

    const rvolRows =
        afterOpen30 && rvolOpening30 && rvolOpening30.length

            ? rvolOpening30

            : rvolLive;

    const rvolTitle =
        afterOpen30 && rvolOpening30

            ? "Highest RVOL (10:00 ET Snapshot)"

            : "Highest RVOL (Live)";

    return (

        <div className="app">

            <header className="header">

                <div>

                    <h1>

                        SNIPER

                    </h1>

                    <p>

                        Institutional Intraday Scanner

                    </p>

                </div>

                <div className="status">

                    <div>

                        <span>Status</span>

                        <strong>

                            {

                                loading

                                    ? "LOADING"

                                    : "LIVE"

                            }

                        </strong>

                    </div>

                    <div>

                        <span>

                            Last Scan

                        </span>

                        <strong>

                            {lastScan}

                        </strong>

                    </div>

                    <div>

                        <span>

                            Refresh

                        </span>

                        <strong>

                            60 sec

                        </strong>

                    </div>

                </div>

            </header>

            <section className="summary">

                <div className="card">

                    <span>

                        Watchlist

                    </span>

                    <strong>

                        {watchlist}

                    </strong>

                </div>

                <div className="card">

                    <span>

                        Playbooks

                    </span>

                    <strong>

                        {playbooks}

                    </strong>

                </div>

                <div className="card">

                    <span>

                        Qualified

                    </span>

                    <strong>

                        {qualified}

                    </strong>

                </div>

                <div className="card">

                    <span>

                        Top Score

                    </span>

                    <strong>

                        {topScore}

                    </strong>

                </div>

            </section>

            {

                error && (

                    <div

                        style={{

                            color: "#ff5d73",

                            marginBottom: 20

                        }}

                    >

                        {error}

                    </div>

                )

            }

            <section className="rvolPanel">

                <div className="panelHeader">

                    {rvolTitle}

                </div>

                {rvolRows.length === 0 ? (

                    <div className="rvolEmpty">

                        No RVOL data yet.

                    </div>

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

                            {rvolRows.map((row, index) => (

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

            <section className="content">

                <div className="tablePanel">

                    <div className="panelHeader">

                        Ranked Setups

                    </div>

                    <table>

                        <thead>

                            <tr>

                                <th>

                                    Symbol

                                </th>

                                <th>

                                    Playbook

                                </th>

                                <th>Triggered</th>

                                <th>

                                    Score

                                </th>

                                <th>

                                    Direction

                                </th>

                                <th>

                                    Entry

                                </th>

                                <th>

                                    R:R

                                </th>

                            </tr>

                        </thead>

                        <tbody>


                              {results.map((scan) => (

                                <tr
                                    key={`${scan.symbol}-${scan.playbook}`}
                                    onClick={() =>
                                        setSelected(scan)
                                    }
                                >

                                    <td>{scan.symbol}</td>

                                    <td>{scan.playbook}</td>

                                    <td>{scan.triggerTime}</td>

                                    <td>{scan.score}</td>

                                    <td>{scan.direction}</td>

                                    <td>
                                        {scan.entry.toFixed(2)}
                                    </td>

                                    <td>
                                        {scan.riskReward.toFixed(2)}
                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

                <div className="detailsPanel">

                    <div className="panelHeader">

                        Trade Details

                    </div>

                    {selected ? (

                        <>

                            <div className="detail">

                                <label>Symbol</label>

                                <strong>

                                    {selected.symbol}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Playbook</label>

                                <strong>

                                    {selected.playbook}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Score</label>

                                <strong>

                                    {selected.score}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Direction</label>

                                <strong>

                                    {selected.direction}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Entry</label>

                                <strong>

                                    {selected.entry.toFixed(2)}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Stop</label>

                                <strong>

                                    {selected.stop.toFixed(2)}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Target</label>

                                <strong>

                                    {selected.target.toFixed(2)}

                                </strong>

                            </div>

                            <div className="detail">

                                <label>Risk / Reward</label>

                                <strong>

                                    {selected.riskReward.toFixed(2)}

                                </strong>

                            </div>

                        </>

                    ) : (

                        <div
                            style={{
                                padding: 20,
                                color: "#8ea2c7"
                            }}
                        >

                            No setup selected.

                        </div>

                    )}

                </div>

            </section>

        </div>

    );

}

export default App;
