/**
 * Sniper
 * Broker Development Kit Client
 *
 * Version: 0.1
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

  // CHANGE THIS TO YOUR DEPLOYED BDK URL
  private readonly baseUrl =
    "https://bdk.daniel-hess7.workers.dev/";

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

    const url = new URL(`${this.baseUrl}/history`);

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("periodType", periodType);
    url.searchParams.set("period", period);
    url.searchParams.set("frequencyType", frequencyType);
    url.searchParams.set("frequency", frequency);
    url.searchParams.set("needExtendedHoursData", "false");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `BDK request failed (${response.status})`
      );
    }

    const data = await response.json();

    // Schwab returns candles in data.candles
    return data.candles ?? [];

  }

}