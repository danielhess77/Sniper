/**
 * Sniper
 * Watchlist Store
 *
 * Version: 1.1
 *
 * Live list: data/watchlist.json (gitignored — UI saves survive git pull)
 * Seed: data/watchlist.default.json or built-in DEFAULT_SYMBOLS
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
    "RGTI",
    "IWM"

];

function dataDir(): string {

    return path.join(process.cwd(), "data");

}

function livePath(): string {

    return path.join(dataDir(), "watchlist.json");

}

function defaultPath(): string {

    return path.join(dataDir(), "watchlist.default.json");

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

function readSymbolsFile(fp: string): string[] | null {

    try {

        if (!fs.existsSync(fp)) return null;

        const raw = fs.readFileSync(fp, "utf8");

        const parsed = JSON.parse(raw) as { symbols?: unknown };

        const normalized = normalizeSymbols(parsed.symbols);

        return normalized.length ? normalized : null;

    } catch {

        return null;

    }

}

export class WatchlistStore {

    private symbols: string[] = [...DEFAULT_SYMBOLS];

    load(): string[] {

        try {

            // 1) Live UI file (gitignored)
            const live = readSymbolsFile(livePath());

            if (live) {

                this.symbols = live;

                return this.get();

            }

            // 2) Seed from default template in repo
            const seeded = readSymbolsFile(defaultPath());

            this.symbols = seeded ?? [...DEFAULT_SYMBOLS];

            // Create live file so next save / restart is stable
            this.writeLive(this.symbols);

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

    private writeLive(symbols: string[]): void {

        const dir = dataDir();

        if (!fs.existsSync(dir)) {

            fs.mkdirSync(dir, { recursive: true });

        }

        const payload =
            JSON.stringify({ symbols }, null, 2) + "\n";

        fs.writeFileSync(livePath(), payload, "utf8");

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

        this.writeLive(normalized);

        this.symbols = normalized;

        console.log(`Watchlist saved (${normalized.length} symbols) → data/watchlist.json`);

        return this.get();

    }

}

export const watchlistStore =
    new WatchlistStore();
