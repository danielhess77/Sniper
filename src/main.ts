import { BDKClient } from "./core/BDKClient.js";
import { TrendQualification } from "./core/TrendQualification.js";

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

  const trend = new TrendQualification();

  const result = trend.evaluate(candles);

  console.log("====================================");
  console.log("   TREND QUALIFICATION");
  console.log("====================================");
  console.log("");

  console.log(`Current Price : ${result.currentPrice.toFixed(2)}`);
  console.log(`VWAP          : ${result.vwap.toFixed(2)}`);
  console.log(`EMA 9         : ${result.ema9.toFixed(2)}`);
  console.log(`EMA 20        : ${result.ema20.toFixed(2)}`);
  console.log(`EMA 50        : ${result.ema50.toFixed(2)}`);

  console.log("");
  console.log("Bullish Checks");
  console.log("------------------------------");

  console.log(`${result.checks.priceAboveVWAP ? "✓" : "✗"} Price > VWAP`);
  console.log(`${result.checks.priceAboveEMA9 ? "✓" : "✗"} Price > EMA 9`);
  console.log(`${result.checks.ema9AboveEMA20 ? "✓" : "✗"} EMA 9 > EMA 20`);
  console.log(`${result.checks.ema20AboveEMA50 ? "✓" : "✗"} EMA 20 > EMA 50`);

  console.log("");
  console.log("Bearish Checks");
  console.log("------------------------------");

  console.log(`${result.checks.priceBelowVWAP ? "✓" : "✗"} Price < VWAP`);
  console.log(`${result.checks.priceBelowEMA9 ? "✓" : "✗"} Price < EMA 9`);
  console.log(`${result.checks.ema9BelowEMA20 ? "✓" : "✗"} EMA 9 < EMA 20`);
  console.log(`${result.checks.ema20BelowEMA50 ? "✓" : "✗"} EMA 20 < EMA 50`);

  console.log("");
  console.log("====================================");
  console.log(`RESULT : ${result.direction}`);
  console.log("====================================");
}

main().catch((error) => {
  console.error("");
  console.error("SNIPER FAILED");
  console.error(error);
});