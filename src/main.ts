import { BDKClient } from "./core/BDKClient.js";
import { TrendContinuation } from "./playbooks/TrendContinuation.js";

async function main() {

    console.clear();

    console.log("====================================");
    console.log("          SNIPER v0.2");
    console.log("====================================");
    console.log("");

    const bdk = new BDKClient();

    console.log("Connecting to BDK...");

    const candles = await bdk.getHistory("SPY");

    console.log(`✓ Downloaded ${candles.length} candles`);
    console.log("");

    const playbook = new TrendContinuation();

    const result = playbook.evaluate(candles);

    console.log("====================================");
    console.log(result.playbook);
    console.log("====================================");
    console.log("");

    console.log(`Trend         : ${result.trend.direction}`);
    console.log(`Pullback      : ${result.pullback.level}`);
    console.log(`Confirmation  : ${result.confirmation.pattern}`);
    console.log(`Signal        : ${result.qualified ? "YES" : "NO"}`);

    console.log("");
    console.log("------------------------------------");
    console.log("Trade");
    console.log("------------------------------------");

    if (result.risk.valid) {

    console.log(`Entry         : ${result.risk.entry.toFixed(2)}`);
    console.log(`Stop          : ${result.risk.stop.toFixed(2)}`);
    console.log(`Target        : ${result.risk.target.toFixed(2)}`);
    console.log(`R/R           : ${result.risk.riskReward.toFixed(2)}`);

    }
    else {

    console.log("No valid trade.");

}

    console.log("");
    console.log("------------------------------------");
    console.log("Market");
    console.log("------------------------------------");

    console.log(`Price         : ${result.trend.currentPrice.toFixed(2)}`);
    console.log(`VWAP          : ${result.trend.vwap.toFixed(2)}`);
    console.log(`EMA 9         : ${result.trend.ema9.toFixed(2)}`);
    console.log(`EMA 20        : ${result.trend.ema20.toFixed(2)}`);
    console.log(`EMA 50        : ${result.trend.ema50.toFixed(2)}`);

    console.log("");
}

main().catch((error) => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});