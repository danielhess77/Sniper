import { BDKClient } from "./core/BDKClient.js";
import { Scanner } from "./core/Scanner.js";
import { WATCHLIST } from "./config/Watchlist.js";

import { TrendContinuation } from "./playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "./playbooks/OpeningRangeBreakout.js";
import { VWAPReclaim } from "./playbooks/VWAPReclaim.js";
import { FirstPullback } from "./playbooks/FirstPullback.js";

const SCAN_INTERVAL = 60_000;

function sleep(ms: number): Promise<void> {

    return new Promise(resolve => setTimeout(resolve, ms));

}

async function runScan(scanner: Scanner): Promise<void> {

    console.clear();

    const scanTime =
        new Date().toLocaleTimeString(
            "en-US",
            {
                timeZone: "America/New_York",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }
        );

    console.log("========================================");
    console.log("            SNIPER v0.7");
    console.log("========================================");
    console.log("");

    console.log(`Scan Time : ${scanTime} ET`);
    console.log("");

    console.log(
        `Scanning ${WATCHLIST.length} symbol(s)...`
    );

    console.log(
        WATCHLIST.join(", ")
    );

    console.log("");

    const results =
        await scanner.scan(WATCHLIST);

    const scoredResults =
        [...results].sort(
            (a, b) => b.score - a.score
        );

    const qualifiedResults =
        scoredResults.filter(
            result => result.qualified
        );

    console.log("----------------------------------------");
    console.log("SCAN SUMMARY");
    console.log("----------------------------------------");

    console.log(
        `Playbook Evaluations : ${results.length}`
    );

    console.log(
        `Qualified Setups     : ${qualifiedResults.length}`
    );

    console.log("");

    //----------------------------------------
    // Top Ranked Setups
    //----------------------------------------

    console.log("----------------------------------------");
    console.log("TOP 10 RANKED SETUPS");
    console.log("----------------------------------------");
    console.log("");

    const topResults =
        scoredResults.slice(0, 10);

    if (topResults.length === 0) {

        console.log("No scan results available.");
        console.log("");

    } else {

        for (const scan of topResults) {

            console.log(
                `${scan.symbol.padEnd(6)} ` +
                `${scan.playbook.padEnd(26)} ` +
                `Score ${scan.score}`
            );

        }

        console.log("");

    }

    //----------------------------------------
    // Qualified Trades
    //----------------------------------------

    console.log("----------------------------------------");
    console.log("QUALIFIED TRADES");
    console.log("----------------------------------------");
    console.log("");

    if (qualifiedResults.length === 0) {

        console.log("No qualified setups found.");
        console.log("");
        return;

    }

    for (const scan of qualifiedResults) {

        console.log("========================================");

        console.log(scan.symbol);

        console.log(
            `Playbook : ${scan.playbook}`
        );

        console.log(
            `Score    : ${scan.score}`
        );

        console.log(
            `Direction: ${scan.direction}`
        );

        console.log("");

        console.log(
            `Entry    : ${scan.entry.toFixed(2)}`
        );

        console.log(
            `Stop     : ${scan.stop.toFixed(2)}`
        );

        console.log(
            `Target   : ${scan.target.toFixed(2)}`
        );

        console.log(
            `R:R      : ${scan.riskReward.toFixed(2)}`
        );

        console.log("========================================");
        console.log("");

    }

}

async function main(): Promise<void> {

    const bdk =
        new BDKClient();

    const scanner =
        new Scanner(
            bdk,
            [
                new TrendContinuation(),
                new OpeningRangeBreakout(),
                new VWAPReclaim(),
                new FirstPullback()
            ]
        );

    while (true) {

        try {

            await runScan(scanner);

        } catch (error) {

            console.error("");
            console.error("========================================");
            console.error("SNIPER SCAN FAILED");
            console.error("========================================");
            console.error(error);
            console.error("");

        }

        console.log(
            `Next scan in ${SCAN_INTERVAL / 1000} seconds...`
        );

        await sleep(SCAN_INTERVAL);

    }

}

main().catch(error => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});