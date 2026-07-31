import { BDKClient } from "./core/BDKClient.js";
import { Scanner } from "./core/Scanner.js";
import { WATCHLIST } from "./config/Watchlist.js";

import { TrendContinuation } from "./playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "./playbooks/OpeningRangeBreakout.js";
import { VWAPReclaim } from "./playbooks/VWAPReclaim.js";
import { FirstPullback } from "./playbooks/FirstPullback.js";

const SCAN_INTERVAL = 60_000;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runScan(scanner: Scanner) {

    console.clear();

    console.log("========================================");
    console.log("            SNIPER v0.5");
    console.log("========================================");
    console.log("");
    const scanTime = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
});

console.log(`Scan Time : ${scanTime} ET`);
    console.log("");

    console.log(`Scanning ${WATCHLIST.length} symbol(s)...`);
    console.log(WATCHLIST.join(", "));
    console.log("");

    const results = await scanner.scan(WATCHLIST);

    const qualifiedResults = results
        .filter(r => r.qualified)
        .sort((a, b) => b.result.score - a.result.score);

    console.log("========================================");
    console.log("SCAN SUMMARY");
    console.log("========================================");
    console.log(`Playbook Evaluations : ${results.length}`);
    console.log(`Qualified Setups     : ${qualifiedResults.length}`);
    console.log("");

    if (qualifiedResults.length === 0) {

        console.log("No qualified setups found.");
        return;

    }

    for (const scan of qualifiedResults) {

        const trade = scan.result.trade ?? scan.result.risk;

        const direction =
            scan.result.trend?.direction ??
            scan.result.openingRange?.direction ??
            "N/A";

        console.log("----------------------------------------");
        console.log(scan.symbol);
        console.log(`Playbook : ${scan.playbook}`);
        console.log(`Score    : ${scan.result.score}`);
        console.log(`Direction: ${direction}`);
        console.log("");
        console.log(`Entry    : ${trade.entry.toFixed(2)}`);
        console.log(`Stop     : ${trade.stop.toFixed(2)}`);
        console.log(`Target   : ${trade.target.toFixed(2)}`);
        console.log(`R:R      : ${trade.riskReward.toFixed(2)}`);
        console.log("----------------------------------------");
        console.log("");
    }

}

async function main() {

    const bdk = new BDKClient();

    const scanner = new Scanner(

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

            console.error(error);

        }

        console.log("");
        console.log(`Next scan in ${SCAN_INTERVAL / 1000} seconds...`);

        await sleep(SCAN_INTERVAL);

    }

}

main().catch(console.error);