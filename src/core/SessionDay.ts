/**
 * America/New_York calendar helpers for intraday session gating.
 */

export function etCalendarDay(ms: number = Date.now()): string {

    return new Intl.DateTimeFormat("en-CA", {

        timeZone: "America/New_York",

        year: "numeric",

        month: "2-digit",

        day: "2-digit"

    }).format(new Date(ms));

}

/** True if timestamp falls on today's date in US/Eastern. */
export function isTodayEt(ms: number): boolean {

    if (!Number.isFinite(ms) || ms <= 0) return false;

    return etCalendarDay(ms) === etCalendarDay(Date.now());

}

/**
 * Minutes since 9:30 AM ET (can be negative before open).
 * Used for soft messaging only.
 */
export function sessionMinuteEt(ms: number = Date.now()): number {

    const parts = new Intl.DateTimeFormat("en-US", {

        timeZone: "America/New_York",

        hour: "2-digit",

        minute: "2-digit",

        hour12: false

    }).formatToParts(new Date(ms));

    const hour = Number(parts.find(p => p.type === "hour")?.value ?? 0);

    const minute = Number(parts.find(p => p.type === "minute")?.value ?? 0);

    return hour * 60 + minute - (9 * 60 + 30);

}
