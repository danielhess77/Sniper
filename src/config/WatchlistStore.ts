/**
 * Sniper
 * Watchlist Store
 *
 * Version: 1.0
 *
 * Loads / saves the live watchlist from data/watchlist.json.
 * Falls back to DEFAULT_SYMBOLS if the file is missing.
 */

import fs from "fs";
import path from "path";

const DEFAULT_SYMBOLS: string[] = [

    "SPY",
    "QQQ",
    "AMD",
    "NVDA",
    "MSFT",
    "AVGO",
    "GOOGL",
    "TSLA",
    "SMH",
    "MRVL",
    "SMCI",
    "INTC",
    "ON",
    "ORCL",
    "META",
    "AMZN",
    "DIS",
    "NKE",
    "MCD",
    "COST",
    "HOOD",
    "PYPL",
    "SOFI",
    "MSTR",
    "MARA",
    "SLV",
    "GLD",
    "GDX",
    "SLB",
    "HAL",
    "GILD",
    "XBI",
    "PFE",
    "ABBV",
    "RGTI"

];

function filePath(): string {

    return path.join(process.cwd(), "data", "watchlist.json");

}

/** Normalize: uppercase, strip non A-Z0-9.-, dedupe, drop empties */
export function normalizeSymbols(

    input: unknown

): string[] {

    if (!Array.isArray(input)) {

        return [];

    }

    const seen = new Set<string>();

    const out: string[] = [];

    for (const raw of input) {

        if (typeof raw !== "string") {

            continue;

        }

        const symbol =
            raw
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9.\-]/g, "");

        if (!symbol || symbol.length > 12) {

            continue;

        }

        if (seen.has(symbol)) {

            continue;

        }

        seen.add(symbol);

        out.push(symbol);

    }

    return out;

}

export class WatchlistStore {

    private symbols: string[] = [...DEFAULT_SYMBOLS];

    load(): string[] {

        try {

            const fp = filePath();

            if (!fs.existsSync(fp)) {

                this.symbols = [...DEFAULT_SYMBOLS];

                this.save(this.symbols);

                return this.get();

            }

            const raw =
                fs.readFileSync(fp, "utf8");

            const parsed =
                JSON.parse(raw) as { symbols?: unknown };

            const normalized =
                normalizeSymbols(parsed.symbols);

            this.symbols =
                normalized.length
                    ? normalized
                    : [...DEFAULT_SYMBOLS];

        } catch (err) {

            console.error("Watchlist load failed, using defaults", err);

            this.symbols = [...DEFAULT_SYMBOLS];

        }

        return this.get();

    }

    get(): string[] {

        return [...this.symbols];

    }

    count(): number {

        return this.symbols.length;

    }

    save(

        input: unknown

    ): string[] {

        const normalized =
            normalizeSymbols(input);

        if (normalized.length === 0) {

            throw new Error("Watchlist cannot be empty");

        }

        if (normalized.length > 100) {

            throw new Error("Watchlist limited to 100 symbols");

        }

        const dir =
            path.join(process.cwd(), "data");

        if (!fs.existsSync(dir)) {

            fs.mkdirSync(dir, { recursive: true });

        }

        const payload =
            JSON.stringify({ symbols: normalized }, null, 2) + "\n";

        fs.writeFileSync(filePath(), payload, "utf8");

        this.symbols = normalized;

        return this.get();

    }

}

export const watchlistStore =
    new WatchlistStore();
