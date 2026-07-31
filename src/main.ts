import { BDKClient } from "./core/BDKClient.js";
import { Scanner } from "./core/Scanner.js";
import { TrendContinuation } from "./playbooks/TrendContinuation.js";
import { OpeningRangeBreakout } from "./playbooks/OpeningRangeBreakout.js";

async function main() {

    console.clear();

    console.log("====================================");
    console.log("          SNIPER v0.3");
    console.log("====================================");
    console.log("");

    const bdk = new BDKClient();

    console.log("Connecting to BDK...");
    console.log("");

    const scanner = new Scanner(
        bdk,
        [
            new TrendContinuation(),
            new OpeningRangeBreakout()
        ]
    );

    const symbols = [
        "SPY"
    ];

    const results =
        await scanner.scan(symbols);

    console.log("------------------------------------");
    console.log("Scan Summary");
    console.log("------------------------------------");
    console.log("");

    if (results.length === 0) {

        console.log("No qualified setups found.");
        return;

    }

    console.log(
        `Found ${results.length} qualified setup(s)`
    );

    console.log("");

    for (const scan of results) {

        console.log("====================================");
        console.log(`${scan.symbol} • ${scan.playbook}`);
        console.log("====================================");

        console.log(
            `Qualified : ${scan.qualified ? "YES" : "NO"}`
        );

        console.log("");

    }

}

main().catch((error) => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});