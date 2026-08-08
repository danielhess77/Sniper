/**
 * Sniper
 * Broker Development Kit Client
 *
 * Version: 1.0
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

export interface OptionContract {

    putCall: string;

    symbol: string;

    description: string;

    bid: number;

    ask: number;

    last: number;

    mark: number;

    delta: number;

    gamma: number;

    theta: number;

    vega: number;

    volatility: number;

    openInterest: number;

    totalVolume: number;

    strikePrice: number;

    expirationDate: string;

    daysToExpiration: number;

    inTheMoney: boolean;

}

export interface OptionChainResult {

    symbol: string;

    underlyingPrice: number;

    callExpDateMap: Record<string, Record<string, OptionContract[]>>;

    putExpDateMap: Record<string, Record<string, OptionContract[]>>;

}

export class BDKClient {

    private readonly baseUrl =
        "https://bdk.daniel-hess7.workers.dev";

    async getHistory(

        symbol: string,

        frequencyType = "minute",

        frequency = "1",

        extendedHours = true

    ): Promise<Candle[]> {

        const url =
            new URL("/history", this.baseUrl);

        const now = new Date();

        const start = new Date(now);

        start.setHours(4, 0, 0, 0);

        url.searchParams.set("symbol", symbol);

        url.searchParams.set("startDate", start.getTime().toString());

        url.searchParams.set("endDate", now.getTime().toString());

        url.searchParams.set("periodType", "day");

        url.searchParams.set("frequencyType", frequencyType);

        url.searchParams.set("frequency", frequency);

        url.searchParams.set(
            "needExtendedHoursData",
            extendedHours ? "true" : "false"
        );

        return this.fetchCandles(url);

    }

    async getMinuteHistory(

        symbol: string,

        days: number = 10,

        frequency = "5"

    ): Promise<Candle[]> {

        const url =
            new URL("/history", this.baseUrl);

        const period =
            Math.min(10, Math.max(1, Math.floor(days)));

        url.searchParams.set("symbol", symbol);

        url.searchParams.set("periodType", "day");

        url.searchParams.set("period", String(period));

        url.searchParams.set("frequencyType", "minute");

        url.searchParams.set("frequency", frequency);

        url.searchParams.set("needExtendedHoursData", "false");

        return this.fetchCandles(url);

    }

    async getDailyHistory(

        symbol: string,

        months: 1 | 2 | 3 | 6 = 6

    ): Promise<Candle[]> {

        const url =
            new URL("/history", this.baseUrl);

        url.searchParams.set("symbol", symbol);

        url.searchParams.set("periodType", "month");

        url.searchParams.set("period", String(months));

        url.searchParams.set("frequencyType", "daily");

        url.searchParams.set("frequency", "1");

        url.searchParams.set("needExtendedHoursData", "false");

        return this.fetchCandles(url);

    }

    async getQuotes(

        symbols: string[]

    ): Promise<QuoteSnapshot[]> {

        if (symbols.length === 0) return [];

        const url =
            new URL("/quotes", this.baseUrl);

        url.searchParams.set("symbols", symbols.join(","));

        console.log("");
        console.log("=== BDK Quotes ===");
        console.log(url.toString());
        console.log("==================");

        const response = await fetch(url);

        if (!response.ok) {

            const body = await response.text();

            console.error("BDK Quotes Response:");
            console.error(body);

            throw new Error(`BDK quotes failed (${response.status})`);

        }

        const data =
            await response.json() as Record<string, any>;

        const snapshots: QuoteSnapshot[] = [];

        for (const symbol of symbols) {

            const row = data[symbol];

            if (!row) continue;

            const quote = row.quote ?? {};

            const fundamental = row.fundamental ?? {};

            snapshots.push({

                symbol,

                lastPrice: Number(quote.lastPrice ?? quote.mark ?? 0),

                totalVolume: Number(quote.totalVolume ?? 0),

                avg10DaysVolume: Number(fundamental.avg10DaysVolume ?? 0),

                netPercentChange: Number(quote.netPercentChange ?? 0)

            });

        }

        return snapshots;

    }

    async getOptionChain(

        symbol: string

    ): Promise<OptionChainResult> {

        const url =
            new URL("/options", this.baseUrl);

        url.searchParams.set("symbol", symbol);

        console.log("");
        console.log("=== BDK Options ===");
        console.log(url.toString());
        console.log("===================");

        const response = await fetch(url);

        if (!response.ok) {

            const body = await response.text();

            console.error("BDK Options Response:");
            console.error(body);

            throw new Error(
                `BDK options failed (${response.status}): ${body.slice(0, 200)}`
            );

        }

        const data = await response.json() as any;

        return {

            symbol: data.symbol ?? symbol,

            underlyingPrice: Number(data.underlyingPrice ?? 0),

            callExpDateMap: data.callExpDateMap ?? {},

            putExpDateMap: data.putExpDateMap ?? {}

        };

    }

    private async fetchCandles(

        url: URL

    ): Promise<Candle[]> {

        console.log("");
        console.log("=== BDK Request ===");
        console.log(url.toString());
        console.log("===================");

        const response = await fetch(url);

        if (!response.ok) {

            const body = await response.text();

            console.error("BDK Response:");
            console.error(body);

            throw new Error(
                `BDK request failed (${response.status}): ${body.slice(0, 200)}`
            );

        }

        const data = await response.json();

        return data.candles ?? [];

    }

}
