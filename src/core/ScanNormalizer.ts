/**
 * ScanNormalizer
 *
 * Converts every playbook's unique output
 * into one common ScanCard object.
 */

import { Candle } from "./BDKClient.js";
import type { ScanCard } from "../types.js";

export function normalizeScan(

    symbol: string,

    result: any,

    candles: Candle[]

): ScanCard {

    const trade =
        result.trade ??
        result.risk;

    const direction =

        result.trend?.direction ??

        result.openingRange?.direction ??

        "NONE";

    const signalIndex =

        result.confirmation?.candleIndex >= 0

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

    const triggerTime =

        signalCandle

            ? new Date(
                signalCandle.datetime
            ).toLocaleTimeString(
                "en-US",
                {
                    timeZone: "America/New_York",
                    hour: "numeric",
                    minute: "2-digit"
                }
            )

            : "--";

    return {

        symbol,

        playbook:
            result.playbook,

        triggerTime,

        qualified:
            result.qualified,

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