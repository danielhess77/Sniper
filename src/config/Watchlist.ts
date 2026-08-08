/**
 * Sniper
 * Watchlist (compatibility export)
 *
 * Prefer watchlistStore.get() at request time so UI edits apply
 * without restarting the process mid-request.
 *
 * DEFAULT list seeds data/watchlist.json on first load.
 */

import { watchlistStore } from "./WatchlistStore.js";

/** Snapshot at module load — mainly for scripts. Live path: watchlistStore.get() */
export const WATCHLIST: string[] =
    watchlistStore.load();
