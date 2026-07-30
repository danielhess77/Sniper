import { BDKClient } from "./core/BDKClient.js";
import { TrendQualification } from "./core/TrendQualification.js";

async function main() {
    console.log("====================================");
    console.log("      SNIPER v0.1");
    console.log("====================================");
    console.log("");

    const bdk = new BDKClient();

    console.log("Connecting to BDK...");

    const candles = await bdk.getHistory("SPY");

    console.log(`✓ Downloaded ${candles.length} candles`);

    const trend = new TrendQualification();

    const result = trend.evaluate(candles);

    console.log("");
    console.log("Trend Analysis");
    console.log("----------------");
    console.log(result);
}

main().catch(console.error);