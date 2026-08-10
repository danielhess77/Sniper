/**
 * ScanNormalizer
 *
 * Session gate: prefer signal bar on today ET.
 * Fallback: if eval series last bar is today (Scanner already scoped),
 * accept playbook.qualified — avoids false zero from bad/missing signal index.
 */

import { Candle } from "./BDKClient.js";
import type { ScanCard } from "../types.js";
import { isTodayEt, etCalendarDay } from "./SessionDay.js";

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

    let signalIndex =

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

    // Clamp OOB indices (Opening Drive previously used 405 on shorter series)
    if (signalIndex >= candles.length) {

        signalIndex = candles.length - 1;

    }

    const signalCandle =

        signalIndex >= 0 && signalIndex < candles.length

            ? candles[signalIndex]

            : undefined;

    const lastCandle =

        candles.length > 0

            ? candles[candles.length - 1]

            : undefined;

    const signalMs =

        signalCandle

            ? Number(signalCandle.datetime)

            : NaN;

    const lastMs =

        lastCandle

            ? Number(lastCandle.datetime)

            : NaN;

    const triggerTime =

        Number.isFinite(signalMs)

            ? formatEtTime(signalMs)

            : Number.isFinite(lastMs)

                ? formatEtTime(lastMs)

                : "--";

    const signalToday =

        Number.isFinite(signalMs) && isTodayEt(signalMs);

    const seriesToday =

        Number.isFinite(lastMs) && isTodayEt(lastMs);

    // Scanner feeds today-scoped bars; if series is today, trust playbook qualify
    const onTodaySession =

        signalToday || seriesToday;

    const qualified =

        Boolean(result.qualified) &&
        Boolean(trade?.valid) &&
        onTodaySession &&
        (trade?.entry ?? 0) > 0;

    const qualifiedAtMs =

        Number.isFinite(signalMs) ? signalMs : lastMs;

    const qualifiedAt =

        qualified && Number.isFinite(qualifiedAtMs)

            ? toIso(qualifiedAtMs)

            : null;

    if (result.qualified && !qualified) {

        console.log(

            `[normalize] ${symbol} ${result.playbook}: playbook=yes but card=no ` +

            `(signalToday=${signalToday} seriesToday=${seriesToday} ` +

            `tradeValid=${Boolean(trade?.valid)} entry=${trade?.entry ?? 0} ` +

            `signalIdx=${signalIndex}/${candles.length} ` +

            `day=${Number.isFinite(signalMs) ? etCalendarDay(signalMs) : "?"})`

        );

    }

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
