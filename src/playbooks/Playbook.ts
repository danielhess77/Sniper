/**
 * Playbook Interface
 *
 * Every Sniper playbook evaluates
 * a set of candles and returns
 * a result.
 */

import { Candle } from "../core/BDKClient.js";

export interface Playbook<T> {

    evaluate(
        candles: Candle[]
    ): T;

}