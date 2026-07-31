import { BDKClient } from "./core/BDKClient.js";
import { Scanner } from "./core/Scanner.js";
import { WATCHLIST } from "./config/Watchlist.js";
import { TrendContinuation } from "./playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "./playbooks/OpeningRangeBreakout.js";

async function main() {

    console.clear();

    console.log("====================================");
    console.log("          SNIPER v0.4");
    console.log("====================================");
    console.log("");

    const bdk = new BDKClient();

    const scanner = new Scanner(
        bdk,
        [
            new TrendContinuation(),
            new OpeningRangeBreakout()
        ]
    );

    console.log(
        `Scanning ${WATCHLIST.length} symbol(s)...`
    );

    console.log(
        WATCHLIST.join(", ")
    );

    console.log("");

    const results =
        await scanner.scan(WATCHLIST);

    const qualifiedResults =
        results.filter(
            result => result.qualified
        );

    console.log("------------------------------------");
    console.log("Scan Summary");
    console.log("------------------------------------");
    console.log("");

    console.log(
        `Playbook evaluations : ${results.length}`
    );

    console.log(
        `Qualified setups     : ${qualifiedResults.length}`
    );

    console.log("");

    if (qualifiedResults.length === 0) {

        console.log("No qualified setups found.");
        return;

    }

    for (const scan of qualifiedResults) {

        console.log("====================================");

        console.log(
            `${scan.symbol} • ${scan.playbook}`
        );

        console.log("====================================");

        console.log("Qualified : YES");
        console.log("");

    }

}

main().catch((error) => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});