import { BDKClient } from "./core/BDKClient.js";
import { TrendContinuation } from "./playbooks/TrendContinuation.js";

async function main() {

  console.clear();

  console.log("====================================");
  console.log("        SNIPER v0.1");
  console.log("====================================");
  console.log("");

  const bdk = new BDKClient();

  console.log("Connecting to BDK...");

  const candles = await bdk.getHistory("SPY");

  console.log(`✓ Downloaded ${candles.length} candles`);
  console.log("");

  const playbook = new TrendContinuation();

  const result = playbook.evaluate(candles);

  const trend = result.trend;

  console.log("====================================");
  console.log("   TREND QUALIFICATION");
  console.log("====================================");
  console.log("");

  console.log(`Current Price : ${trend.currentPrice.toFixed(2)}`);
  console.log(`VWAP          : ${trend.vwap.toFixed(2)}`);
  console.log(`EMA 9         : ${trend.ema9.toFixed(2)}`);
  console.log(`EMA 20        : ${trend.ema20.toFixed(2)}`);
  console.log(`EMA 50        : ${trend.ema50.toFixed(2)}`);

  console.log("");
  console.log("Bullish Checks");
  console.log("------------------------------");

  console.log(`${trend.checks.priceAboveVWAP ? "✓" : "✗"} Price > VWAP`);
  console.log(`${trend.checks.priceAboveEMA9 ? "✓" : "✗"} Price > EMA 9`);
  console.log(`${trend.checks.ema9AboveEMA20 ? "✓" : "✗"} EMA 9 > EMA 20`);
  console.log(`${trend.checks.ema20AboveEMA50 ? "✓" : "✗"} EMA 20 > EMA 50`);

  console.log("");
  console.log("Bearish Checks");
  console.log("------------------------------");

  console.log(`${trend.checks.priceBelowVWAP ? "✓" : "✗"} Price < VWAP`);
  console.log(`${trend.checks.priceBelowEMA9 ? "✓" : "✗"} Price < EMA 9`);
  console.log(`${trend.checks.ema9BelowEMA20 ? "✓" : "✗"} EMA 9 < EMA 20`);
  console.log(`${trend.checks.ema20BelowEMA50 ? "✓" : "✗"} EMA 20 < EMA 50`);

  console.log("");
  console.log("====================================");
  console.log(`PLAYBOOK : ${result.playbook}`);
  console.log(`QUALIFIED: ${result.qualified ? "YES" : "NO"}`);
  console.log(`TREND    : ${trend.direction}`);
  console.log("====================================");

}

main().catch((error) => {
  console.error("");
  console.error("SNIPER FAILED");
  console.error(error);
});