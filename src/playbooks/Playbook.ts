/**
 * Sniper
 * Playbook Interface
 */

import { Candle } from "../core/BDKClient.js";

export interface ValidationResult {

    active: boolean;

    reason: string;

}

export interface Playbook<T> {

    evaluate(
        candles: Candle[]
    ): T;

    validate(
        candles: Candle[],
        result: T
    ): ValidationResult;

}