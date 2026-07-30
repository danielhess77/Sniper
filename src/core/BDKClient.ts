/**
 * Sniper
 * Broker Development Kit Client
 *
 * Version: 0.2
 *
 * Purpose:
 * Retrieve market data from the BDK.
 */

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  datetime: number;
}

export class BDKClient {

  // Base URL of your deployed BDK Worker
  private readonly baseUrl =
    "https://bdk.daniel-hess7.workers.dev";

  /**
   * Retrieve historical candles.
   */
  async getHistory(
    symbol: string,
    periodType = "day",
    period = "1",
    frequencyType = "minute",
    frequency = "1"
  ): Promise<Candle[]> {

    const url = new URL("/history", this.baseUrl);

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("periodType", periodType);
    url.searchParams.set("period", period);
    url.searchParams.set("frequencyType", frequencyType);
    url.searchParams.set("frequency", frequency);
    url.searchParams.set("needExtendedHoursData", "false");

    console.log("");
    console.log("=== BDK Request ===");
    console.log(url.toString());
    console.log("===================");
    console.log("");

    const response = await fetch(url);

    if (!response.ok) {

      const body = await response.text();

      console.error("BDK Response:");
      console.error(body);

      throw new Error(
        `BDK request failed (${response.status})`
      );
    }

    const data = await response.json();

    return data.candles ?? [];
  }

}