/**
 * ScanNormalizer
 *
 * Converts every playbook's unique output into one common ScanCard.
 * Intraday: trigger must be on today's America/New_York calendar day
 * or the card is forced unqualified (prior-session noise filtered).
 */

import { Candle } from "./BDKClient.js";
import type { ScanCard } from "../types.js";
import { isTodayEt } from "./SessionDay.js";

function formatEtTime(ms: number): string {

    return new Date(ms).toLocaleTimeString("en-US", {

        timeZone: "America/New_York",

        hour: "numeric",

        minute: "2-digit"

    });

}

function toIso(ms: number): string {

    return new Date(ms).toISOString();

}

export function normalizeScan(

    symbol: string,

    result: any,

    candles: Candle[]

): ScanCard {

    const trade =
        result.trade ??
        result.risk;

    const direction =

        result.openingRange?.direction ??

        result.drive?.direction ??

        result.trend?.direction ??

        "NONE";

    const signalIndex =

        result.drive?.confirmIndex >= 0

            ? result.drive.confirmIndex

            : result.openingRange?.failIndex >= 0

                ? result.openingRange.failIndex

                : result.openingRange?.confirmIndex >= 0

                    ? result.openingRange.confirmIndex

                    : result.confirmation?.candleIndex >= 0

                        ? result.confirmation.candleIndex

                        : result.openingRange?.breakoutIndex >= 0

                            ? result.openingRange.breakoutIndex

                            : result.reclaim?.candleIndex >= 0

                                ? result.reclaim.candleIndex

                                : result.pullback?.candleIndex >= 0

                                    ? result.pullback.candleIndex

                                    : -1;

    const signalCandle =

        signalIndex >= 0

            ? candles[signalIndex]

            : undefined;

    const signalMs =

        signalCandle

            ? Number(signalCandle.datetime)

            : NaN;

    const triggerTime =

        Number.isFinite(signalMs)

            ? formatEtTime(signalMs)

            : "--";

    const onTodaySession =

        Number.isFinite(signalMs) && isTodayEt(signalMs);

    // Playbook may say qualified; prior-session triggers are not "live" for 0DTE
    const qualified =

        Boolean(result.qualified) && onTodaySession;

    const qualifiedAt =

        qualified && Number.isFinite(signalMs)

            ? toIso(signalMs)

            : null;

    return {

        symbol,

        playbook:
            result.playbook,

        triggerTime,

        qualifiedAt,

        qualified,

        score:
            result.score ?? 0,

        direction,

        entry:
            trade?.entry ?? 0,

        stop:
            trade?.stop ?? 0,

        target:
            trade?.target ?? 0,

        riskReward:
            trade?.riskReward ?? 0

    };

}
