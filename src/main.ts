import { BDKClient } from "./core/BDKClient.js";
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

    const candles =
        await bdk.getHistory("SPY");

    console.log(
        `✓ Downloaded ${candles.length} candles`
    );

    console.log("");

    //----------------------------------
    // Trend Continuation
    //----------------------------------

    const trendPlaybook =
        new TrendContinuation();

    const trend =
        trendPlaybook.evaluate(candles);

    console.log("====================================");
    console.log(trend.playbook);
    console.log("====================================");
    console.log("");

    console.log(
        `Trend         : ${trend.trend.direction}`
    );

    console.log(
        `Pullback      : ${trend.pullback.level}`
    );

    console.log(
        `Confirmation  : ${trend.confirmation.pattern}`
    );

    console.log(
        `Qualified     : ${trend.qualified ? "YES" : "NO"}`
    );

    console.log("");

    console.log("------------------------------------");
    console.log("Trade");
    console.log("------------------------------------");

    if (trend.risk.valid) {

        console.log(
            `Entry         : ${trend.risk.entry.toFixed(2)}`
        );

        console.log(
            `Stop          : ${trend.risk.stop.toFixed(2)}`
        );

        console.log(
            `Target        : ${trend.risk.target.toFixed(2)}`
        );

        console.log(
            `R/R           : ${trend.risk.riskReward.toFixed(2)}`
        );

    } else {

        console.log("No valid trade.");

    }

    console.log("");

    //----------------------------------
    // Opening Range Breakout
    //----------------------------------

    const orbPlaybook =
        new OpeningRangeBreakout();

    const orb =
        orbPlaybook.evaluate(candles);

    console.log("====================================");
    console.log(orb.playbook);
    console.log("====================================");
    console.log("");

    console.log(
        `Direction     : ${orb.openingRange.direction}`
    );

    console.log(
        `Confirmation  : ${orb.confirmation.pattern}`
    );

    console.log(
        `Qualified     : ${orb.qualified ? "YES" : "NO"}`
    );

    console.log("");

    console.log("------------------------------------");
    console.log("Trade");
    console.log("------------------------------------");

    if (orb.trade.valid) {

        console.log(
            `Entry         : ${orb.trade.entry.toFixed(2)}`
        );

        console.log(
            `Stop          : ${orb.trade.stop.toFixed(2)}`
        );

        console.log(
            `Target        : ${orb.trade.target.toFixed(2)}`
        );

        console.log(
            `R/R           : ${orb.trade.riskReward.toFixed(2)}`
        );

    } else {

        console.log("No valid trade.");

    }

    console.log("");

    //----------------------------------
    // Market
    //----------------------------------

    console.log("====================================");
    console.log("Market");
    console.log("====================================");
    console.log("");

    console.log(
        `Price         : ${trend.trend.currentPrice.toFixed(2)}`
    );

    console.log(
        `VWAP          : ${trend.trend.vwap.toFixed(2)}`
    );

    console.log(
        `EMA 9         : ${trend.trend.ema9.toFixed(2)}`
    );

    console.log(
        `EMA 20        : ${trend.trend.ema20.toFixed(2)}`
    );

    console.log(
        `EMA 50        : ${trend.trend.ema50.toFixed(2)}`
    );

    console.log("");

}

main().catch((error) => {

    console.error("");
    console.error("SNIPER FAILED");
    console.error(error);

});