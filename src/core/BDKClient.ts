/**
 * Sniper
 * Broker Development Kit Client
 *
 * Version: 0.5
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
    private readonly baseUrl =
        "https://bdk.daniel-hess7.workers.dev";

    private apiKey(): string {
        const key = process.env.BDK_API_KEY;
        if (!key) {
            throw new Error(
                "BDK_API_KEY is not set. Add it to your environment before calling the worker."
            );
        }
        return key;
    }

    private headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.apiKey()}`,
            Accept: "application/json",
        };
    }

    async getHistory(
        symbol: string,
        frequencyType = "minute",
        frequency = "1",
        extendedHours = true
    ): Promise<Candle[]> {
        const url = new URL("/history", this.baseUrl);

        const now = new Date();
        const start = new Date(now);
        start.setHours(4, 0, 0, 0);

        url.searchParams.set("symbol", symbol);
        url.searchParams.set("startDate", start.getTime().toString());
        url.searchParams.set("endDate", now.getTime().toString());
        url.searchParams.set("frequencyType", frequencyType);
        url.searchParams.set("frequency", frequency);
        url.searchParams.set(
            "needExtendedHoursData",
            extendedHours ? "true" : "false"
        );

        console.log("");
        console.log("=== BDK Request ===");
        console.log(url.toString());
        console.log("===================");
        console.log("");

        const response = await fetch(url, {
            headers: this.headers(),
        });

        if (!response.ok) {
            const body = await response.text();
            console.error("BDK Response:");
            console.error(body);
            throw new Error(`BDK request failed (${response.status})`);
        }

        const data = await response.json();
        return data.candles ?? [];
    }
}
