/**
 * ScanNormalizer
 *
 * Converts every playbook's unique output
 * into one common ScanCard object.
 */

import { ScanCard } from "../types.js";

export function normalizeScan(

    symbol: string,

    result: any

): ScanCard {

    // ORB uses trade instead of risk

    const trade = result.trade ?? result.risk;

    // ORB stores direction differently

    const direction =

        result.trend?.direction ??

        result.openingRange?.direction ??

        "NONE";

    return {

        symbol,

        playbook: result.playbook,

        triggerTime:
        new Date().toLocaleTimeString(
        "en-US",
        {
            timeZone: "America/New_York",
            hour: "numeric",
            minute: "2-digit"
        }
    ),

        qualified: result.qualified,

        score: result.score ?? 0,

        direction,

        entry: trade?.entry ?? 0,

        stop: trade?.stop ?? 0,

        target: trade?.target ?? 0,

        riskReward: trade?.riskReward ?? 0

    };

}