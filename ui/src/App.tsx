import { useEffect, useMemo, useState } from "react";
import "./styles.css";

import { getScan } from "./api";
import type { ScanCard } from "./api";

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

    async function refresh() {

        try {

            const response =
                await getScan();

            setResults(response.results);

            setWatchlist(
                response.watchlist
            );

            setPlaybooks(
                response.playbooks
            );

            setQualified(
                response.qualified
            );

            setLastScan(

                new Date(

                    response.timestamp

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

                response.results.length &&
                !selected

            ) {

                setSelected(

                    response.results[0]

                );

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