/**
 * Sniper
 * Broker Development Kit Client
 *
 * Version: 0.6
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

export interface QuoteSnapshot {

    symbol: string;

    lastPrice: number;

    totalVolume: number;

    avg10DaysVolume: number;

    netPercentChange: number;

}

export class BDKClient {

    private readonly baseUrl =
        "https://bdk.daniel-hess7.workers.dev";

    //--------------------------------------------------
    // Intraday history (today)
    //--------------------------------------------------

    async getHistory(

        symbol: string,

        frequencyType = "minute",

        frequency = "1",

        extendedHours = true

    ): Promise<Candle[]> {

        const url =
            new URL(
                "/history",
                this.baseUrl
            );

        const now = new Date();

        const start = new Date(now);

        start.setHours(4, 0, 0, 0);

        url.searchParams.set("symbol", symbol);

        url.searchParams.set(
            "startDate",
            start.getTime().toString()
        );

        url.searchParams.set(
            "endDate",
            now.getTime().toString()
        );

        url.searchParams.set(
            "frequencyType",
            frequencyType
        );

        url.searchParams.set(
            "frequency",
            frequency
        );

        url.searchParams.set(
            "needExtendedHoursData",
            extendedHours ? "true" : "false"
        );

        return this.fetchCandles(url);

    }

    //--------------------------------------------------
    // Daily history (for swing RS / trend / pullback)
    //--------------------------------------------------

    async getDailyHistory(

        symbol: string,

        /** Calendar days of history to request */
        lookbackDays = 180

    ): Promise<Candle[]> {

        const url =
            new URL(
                "/history",
                this.baseUrl
            );

        const now = new Date();

        const start = new Date(now);

        start.setDate(start.getDate() - lookbackDays);

        url.searchParams.set("symbol", symbol);

        url.searchParams.set(
            "startDate",
            start.getTime().toString()
        );

        url.searchParams.set(
            "endDate",
            now.getTime().toString()
        );

        url.searchParams.set(
            "frequencyType",
            "daily"
        );

        url.searchParams.set(
            "frequency",
            "1"
        );

        url.searchParams.set(
            "needExtendedHoursData",
            "false"
        );

        return this.fetchCandles(url);

    }

    //--------------------------------------------------
    // Batch quotes
    //--------------------------------------------------

    async getQuotes(

        symbols: string[]

    ): Promise<QuoteSnapshot[]> {

        if (symbols.length === 0) {

            return [];

        }

        const url =
            new URL(
                "/quotes",
                this.baseUrl
            );

        url.searchParams.set(
            "symbols",
            symbols.join(",")
        );

        console.log("");
        console.log("=== BDK Quotes ===");
        console.log(url.toString());
        console.log("==================");
        console.log("");

        const response =
            await fetch(url);

        if (!response.ok) {

            const body =
                await response.text();

            console.error("BDK Quotes Response:");
            console.error(body);

            throw new Error(
                `BDK quotes failed (${response.status})`
            );

        }

        const data =
            await response.json() as Record<string, any>;

        const snapshots: QuoteSnapshot[] = [];

        for (const symbol of symbols) {

            const row = data[symbol];

            if (!row) {

                continue;

            }

            const quote = row.quote ?? {};

            const fundamental = row.fundamental ?? {};

            snapshots.push({

                symbol,

                lastPrice:
                    Number(
                        quote.lastPrice ??
                        quote.mark ??
                        0
                    ),

                totalVolume:
                    Number(
                        quote.totalVolume ?? 0
                    ),

                avg10DaysVolume:
                    Number(
                        fundamental.avg10DaysVolume ?? 0
                    ),

                netPercentChange:
                    Number(
                        quote.netPercentChange ?? 0
                    )

            });

        }

        return snapshots;

    }

    private async fetchCandles(

        url: URL

    ): Promise<Candle[]> {

        console.log("");
        console.log("=== BDK Request ===");
        console.log(url.toString());
        console.log("===================");
        console.log("");

        const response =
            await fetch(url);

        if (!response.ok) {

            const body =
                await response.text();

            console.error("BDK Response:");
            console.error(body);

            throw new Error(
                `BDK request failed (${response.status})`
            );

        }

        const data =
            await response.json();

        return data.candles ?? [];

    }

}
