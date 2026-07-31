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

    const scanner = new Scanner(
        bdk,
        [
            new TrendContinuation(),
            new OpeningRangeBreakout()
        ]
    );

    const results =
        await scanner.scan("SPY");

    console.log("");

    if (results.length === 0) {

        console.log(
            "No qualified setups found."
        );

    } else {

        console.log(
            `Found ${results.length} qualified setup(s)`
        );

        console.log("");

        for (const scan of results) {

            console.log("====================================");
            console.log(scan.playbook);
            console.log("====================================");
            console.log("");

            console.dir(
                scan.result,
                { depth: null }
            );

            console.log("");

        }

    }

}

main().catch((error) => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});